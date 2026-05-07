const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// GET /api/projects
router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }]
    })
      .populate('owner', 'name email role')
      .populate('members.user', 'name email role')
      .sort({ createdAt: -1 });

    const projectsWithCounts = await Promise.all(projects.map(async (project) => {
      const taskCounts = await Task.aggregate([
        { $match: { project: project._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      const counts = { Todo: 0, 'In Progress': 0, Review: 0, Done: 0, total: 0 };
      taskCounts.forEach(tc => { counts[tc._id] = tc.count; counts.total += tc.count; });
      return { ...project.toObject(), taskCounts: counts };
    }));

    res.json(projectsWithCounts);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/projects — Admin only
router.post('/', auth, [
  body('name').trim().isLength({ min: 2 }).withMessage('Project name must be at least 2 characters'),
  body('description').optional().trim(),
  body('deadline').optional().isISO8601().withMessage('Invalid deadline date')
], async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Only Admins can create projects' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const { name, description, deadline, color } = req.body;
    const project = await Project.create({
      name, description, deadline,
      color: color || '#6366f1',
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'Admin' }]
    });

    const populated = await project.populate([
      { path: 'owner', select: 'name email role' },
      { path: 'members.user', select: 'name email role' }
    ]);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/projects/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email role')
      .populate('members.user', 'name email role');

    if (!project) return res.status(404).json({ message: 'Project not found' });

    const isMember = project.members.some(m => m.user._id.toString() === req.user._id.toString());
    const isOwner = project.owner._id.toString() === req.user._id.toString();
    if (!isMember && !isOwner) return res.status(403).json({ message: 'Access denied' });

    res.json(project);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/projects/:id — update status (Completed etc)
router.put('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, description, status, deadline, color } = req.body;
    const updated = await Project.findByIdAndUpdate(
      req.params.id,
      { name, description, status, deadline, color },
      { new: true, runValidators: true }
    ).populate('owner', 'name email role').populate('members.user', 'name email role');

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/projects/:id/members
router.post('/:id/members', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Only the project owner or Admin can add members' });
    }

    const { userId, role } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const alreadyMember = project.members.some(m => m.user.toString() === userId);
    if (alreadyMember) return res.status(400).json({ message: 'User is already a member' });

    project.members.push({ user: userId, role: role || 'Member' });
    await project.save();

    const updated = await Project.findById(req.params.id)
      .populate('owner', 'name email role')
      .populate('members.user', 'name email role');

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    project.members = project.members.filter(m => m.user.toString() !== req.params.userId);
    await project.save();
    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Task.deleteMany({ project: req.params.id });
    await project.deleteOne();
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
