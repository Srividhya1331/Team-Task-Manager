const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { auth } = require('../middleware/auth');

// Helper: check project membership
const checkProjectAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) return { error: 'Project not found', status: 404 };
  const isMember = project.members.some(m => m.user.toString() === userId.toString());
  const isOwner = project.owner.toString() === userId.toString();
  if (!isMember && !isOwner) return { error: 'Access denied', status: 403 };
  return { project };
};

// GET /api/tasks?project=id - Get tasks for a project
router.get('/', auth, async (req, res) => {
  try {
    const { project, status, priority, assignedTo } = req.query;

    let filter = {};
    if (project) filter.project = project;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    // If no project specified, get all tasks user has access to
    if (!project) {
      const userProjects = await Project.find({
        $or: [{ owner: req.user._id }, { 'members.user': req.user._id }]
      }).select('_id');
      filter.project = { $in: userProjects.map(p => p._id) };
    }

    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name color')
      .populate('comments.user', 'name email')
      .populate('submissions.submittedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/tasks/dashboard - Dashboard stats
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userProjects = await Project.find({
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }]
    }).select('_id');

    const projectIds = userProjects.map(p => p._id);

    const [totalTasks, myTasks, overdueTasks, statusCounts] = await Promise.all([
      Task.countDocuments({ project: { $in: projectIds } }),
      Task.countDocuments({ assignedTo: req.user._id }),
      Task.countDocuments({
        project: { $in: projectIds },
        deadline: { $lt: new Date() },
        status: { $ne: 'Done' }
      }),
      Task.aggregate([
        { $match: { project: { $in: projectIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    const byStatus = { Todo: 0, 'In Progress': 0, Review: 0, Done: 0 };
    statusCounts.forEach(s => { byStatus[s._id] = s.count; });

    res.json({
      totalTasks,
      myTasks,
      overdueTasks,
      totalProjects: projectIds.length,
      byStatus
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/tasks - Create task
router.post('/', auth, [
  body('title').trim().isLength({ min: 2 }).withMessage('Task title must be at least 2 characters'),
  body('project').notEmpty().withMessage('Project is required'),
  body('priority').optional().isIn(['Low', 'Medium', 'High', 'Urgent']),
  body('status').optional().isIn(['Todo', 'In Progress', 'Review', 'Done'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { project: projectId } = req.body;
    const { error, status } = await checkProjectAccess(projectId, req.user._id);
    if (error) return res.status(status).json({ message: error });

    const { title, description, priority, taskStatus, assignedTo, deadline, tags } = req.body;

    const task = await Task.create({
      title,
      description,
      priority,
      status: taskStatus || 'Todo',
      project: projectId,
      assignedTo: assignedTo || null,
      createdBy: req.user._id,
      deadline,
      tags: tags || []
    });

    const populated = await task.populate([
      { path: 'assignedTo', select: 'name email' },
      { path: 'createdBy', select: 'name email' },
      { path: 'project', select: 'name color' }
    ]);

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/tasks/:id - Get single task
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name color')
      .populate('comments.user', 'name email');

    if (!task) return res.status(404).json({ message: 'Task not found' });

    const { error, status } = await checkProjectAccess(task.project._id, req.user._id);
    if (error) return res.status(status).json({ message: error });

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const { error, status } = await checkProjectAccess(task.project, req.user._id);
    if (error) return res.status(status).json({ message: error });

    const { title, description, status: taskStatus, priority, assignedTo, deadline, tags } = req.body;

    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      { title, description, status: taskStatus, priority, assignedTo, deadline, tags },
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name color')
      .populate('comments.user', 'name email');

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/tasks/:id/comments - Add comment
router.post('/:id/comments', auth, [
  body('text').trim().notEmpty().withMessage('Comment text is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.comments.push({ user: req.user._id, text: req.body.text });
    await task.save();

    const updated = await Task.findById(req.params.id)
      .populate('comments.user', 'name email')
      .populate('assignedTo', 'name email')
      .populate('project', 'name color');

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/tasks/:id/submit - Member submits completed work
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const { error, status } = await checkProjectAccess(task.project, req.user._id);
    if (error) return res.status(status).json({ message: error });

    const { fileUrl, notes } = req.body;
    if (!fileUrl && !notes) {
      return res.status(400).json({ message: 'Please provide a file link or notes' });
    }

    task.submissions.push({
      submittedBy: req.user._id,
      fileUrl: fileUrl || '',
      notes: notes || '',
      submittedAt: new Date()
    });

    // Auto-move status to Review when member submits
    if (task.status !== 'Done') task.status = 'Review';

    await task.save();

    const updated = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name color')
      .populate('submissions.submittedBy', 'name email');

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const { error, status } = await checkProjectAccess(task.project, req.user._id);
    if (error) return res.status(status).json({ message: error });

    // Only creator or Admin can delete
    if (task.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Only the task creator or Admin can delete this task' });
    }

    await task.deleteOne();
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
