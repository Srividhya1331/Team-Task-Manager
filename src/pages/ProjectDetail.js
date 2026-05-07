import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getProject, getTasks, createTask, updateTask, deleteTask, getAllUsers, addMember, removeMember, updateProject, submitTask } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { format, isPast } from 'date-fns';

const STATUSES = ['Todo', 'In Progress', 'Review', 'Done'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const statusClass = { 'Todo':'todo', 'In Progress':'progress', 'Review':'review', 'Done':'done' };
const priorityClass = { Low:'low', Medium:'medium', High:'high', Urgent:'urgent' };
const statusColors = { 'Todo':'#64748b', 'In Progress':'#6366f1', 'Review':'#f59e0b', 'Done':'#22c55e' };

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitTask_target, setSubmitTaskTarget] = useState(null);
  const [submitForm, setSubmitForm] = useState({ fileUrl: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title:'', description:'', priority:'Medium', status:'Todo', assignedTo:'', deadline:'', tags:''
  });

  const isAdmin = user?.role === 'Admin' || project?.owner?._id === user?._id;

  const load = async () => {
    try {
      const [p, t, u] = await Promise.all([getProject(id), getTasks({ project: id }), getAllUsers()]);
      setProject(p.data);
      setTasks(t.data);
      setUsers(u.data);
    } catch (err) {
      toast.error('Failed to load project');
      navigate('/projects');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const openCreate = () => {
    setSelectedTask(null);
    setTaskForm({ title:'', description:'', priority:'Medium', status:'Todo', assignedTo:'', deadline:'', tags:'' });
    setShowTaskModal(true);
  };

  const openEdit = task => {
    setSelectedTask(task);
    setTaskForm({
      title: task.title, description: task.description || '',
      priority: task.priority, status: task.status,
      assignedTo: task.assignedTo?._id || '',
      deadline: task.deadline ? task.deadline.slice(0,10) : '',
      tags: task.tags?.join(', ') || ''
    });
    setShowTaskModal(true);
  };

  const handleSaveTask = async e => {
    e.preventDefault();
    if (!taskForm.title.trim()) return toast.error('Task title required');
    setSaving(true);
    try {
      const payload = {
        ...taskForm,
        project: id,
        status: taskForm.status,
        taskStatus: taskForm.status,
        tags: taskForm.tags ? taskForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        assignedTo: taskForm.assignedTo || null
      };
      if (selectedTask) {
        const res = await updateTask(selectedTask._id, payload);
        setTasks(prev => prev.map(t => t._id === selectedTask._id ? res.data : t));
        toast.success('Task updated');
      } else {
        const res = await createTask(payload);
        setTasks(prev => [res.data, ...prev]);
        toast.success('Task created');
      }
      setShowTaskModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save task');
    } finally { setSaving(false); }
  };

  const handleDeleteTask = async taskId => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await deleteTask(taskId);
      setTasks(prev => prev.filter(t => t._id !== taskId));
      setShowTaskModal(false);
      toast.success('Task deleted');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await updateTask(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t._id === taskId ? res.data : t));
      if (newStatus === 'Done') toast.success('Task marked as Done! ✓');
    } catch { toast.error('Failed to update status'); }
  };

  const handleAddMember = async userId => {
    try {
      const res = await addMember(id, { userId });
      setProject(res.data);
      toast.success('Member added');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add member'); }
  };

  const handleRemoveMember = async userId => {
    try {
      await removeMember(id, userId);
      setProject(p => ({ ...p, members: p.members.filter(m => m.user._id !== userId) }));
      toast.success('Member removed');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to remove member'); }
  };

  const handleMarkProjectComplete = async () => {
    try {
      const res = await updateProject(id, { ...project, status: 'Completed' });
      setProject(res.data);
      setShowCompleteModal(false);
      toast.success('🎉 Project marked as Completed!');
    } catch (err) { toast.error('Failed to update project'); }
  };

  const handleReopenProject = async () => {
    try {
      const res = await updateProject(id, { ...project, status: 'Active' });
      setProject(res.data);
      toast.success('Project reopened as Active');
    } catch (err) { toast.error('Failed to reopen project'); }
  };

  const openSubmitModal = (task) => {
    setSubmitTaskTarget(task);
    setSubmitForm({ fileUrl: '', notes: '' });
    setShowSubmitModal(true);
  };

  const handleSubmitWork = async (e) => {
    e.preventDefault();
    if (!submitForm.fileUrl.trim() && !submitForm.notes.trim()) {
      return toast.error('Please add a file link or notes');
    }
    setSubmitting(true);
    try {
      const res = await submitTask(submitTask_target._id, submitForm);
      setTasks(prev => prev.map(t => t._id === submitTask_target._id ? res.data : t));
      setShowSubmitModal(false);
      toast.success('✅ Work submitted! Task moved to Review.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"/></div>;
  if (!project) return null;

  const tasksByStatus = STATUSES.reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s);
    return acc;
  }, {});

  const totalTasks = tasks.length;
  const doneTasks = tasksByStatus['Done']?.length || 0;
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const nonMembers = users.filter(u => !project.members.some(m => m.user._id === u._id));
  const isCompleted = project.status === 'Completed';

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/projects')}>← Back</button>
            <div style={{ width:10, height:10, borderRadius:'50%', background:project.color }}/>
            <h1 className="page-title" style={{ marginBottom:0 }}>{project.name}</h1>
            <span style={{
              fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20,
              background: isCompleted ? '#6366f122' : '#22c55e22',
              color: isCompleted ? '#6366f1' : '#22c55e'
            }}>{project.status}</span>
          </div>
          {project.description && <p className="page-subtitle">{project.description}</p>}
          {project.deadline && (
            <p className="page-subtitle">📅 Deadline: {format(new Date(project.deadline), 'MMM d, yyyy')}</p>
          )}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {isAdmin && <button className="btn btn-secondary" onClick={() => setShowMemberModal(true)}>👥 Manage Members</button>}
          {isAdmin && !isCompleted && (
            <button className="btn btn-primary" style={{ background:'#6366f1' }} onClick={() => setShowCompleteModal(true)}>
              ✓ Mark Complete
            </button>
          )}
          {isAdmin && isCompleted && (
            <button className="btn btn-secondary" onClick={handleReopenProject}>↺ Reopen</button>
          )}
          {!isCompleted && (
            <button className="btn btn-primary" onClick={openCreate}>+ New Task</button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="card" style={{ marginBottom:20, padding:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div>
            <span style={{ fontWeight:600, fontSize:15 }}>Project Progress</span>
            <span style={{ color:'var(--text3)', fontSize:13, marginLeft:10 }}>
              {doneTasks}/{totalTasks} tasks completed
            </span>
          </div>
          <span style={{
            fontSize:18, fontWeight:700,
            color: completionPct === 100 ? '#22c55e' : '#6366f1'
          }}>{completionPct}%</span>
        </div>
        <div style={{ height:10, background:'var(--bg3)', borderRadius:5, overflow:'hidden', marginBottom:12 }}>
          <div style={{
            height:'100%', width:`${completionPct}%`,
            background: completionPct === 100 ? '#22c55e' : 'linear-gradient(90deg,#6366f1,#8b5cf6)',
            borderRadius:5, transition:'width .4s'
          }}/>
        </div>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
          {STATUSES.map(s => (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:statusColors[s] }}/>
              <span style={{ fontSize:12, color:'var(--text2)' }}>{s}: <strong>{tasksByStatus[s]?.length || 0}</strong></span>
            </div>
          ))}
        </div>
      </div>

      {/* Team members */}
      <div className="card" style={{ marginBottom:20, padding:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span style={{ fontSize:13, color:'var(--text3)', fontWeight:500 }}>Team:</span>
          {project.members?.map((m,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div className="member-avatar" title={m.user?.name} style={{ width:30, height:30 }}>
                {m.user?.name?.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize:13 }}>{m.user?.name}</span>
              <span className={`badge badge-${m.role==='Admin'?'admin':'member'}`}>{m.role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Completed banner */}
      {isCompleted && (
        <div style={{
          background:'#22c55e18', border:'1px solid #22c55e44', borderRadius:10,
          padding:'14px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:10
        }}>
          <span style={{ fontSize:22 }}>🎉</span>
          <div>
            <div style={{ fontWeight:600, color:'#22c55e' }}>Project Completed!</div>
            <div style={{ fontSize:13, color:'var(--text2)' }}>This project has been marked as complete. All tasks are archived.</div>
          </div>
        </div>
      )}

      {/* View tabs */}
      <div className="tabs" style={{ marginBottom:20 }}>
        <button className={`tab${view==='kanban'?' active':''}`} onClick={() => setView('kanban')}>Kanban Board</button>
        <button className={`tab${view==='list'?' active':''}`} onClick={() => setView('list')}>List View</button>
      </div>

      {/* Kanban */}
      {view === 'kanban' && (
        <div className="kanban">
          {STATUSES.map(status => (
            <div key={status} className="kanban-col">
              <div className="kanban-col-header" style={{ borderTop:`3px solid ${statusColors[status]}` }}>
                <span className="kanban-col-title">{status}</span>
                <span className="kanban-count">{tasksByStatus[status]?.length || 0}</span>
              </div>
              <div className="kanban-tasks">
                {tasksByStatus[status]?.map(task => (
                  <div key={task._id} className="kanban-task" onClick={() => openEdit(task)}>
                    <div className="kanban-task-title">{task.title}</div>
                    {task.description && (
                      <div className="text-muted text-sm" style={{ marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                        {task.description}
                      </div>
                    )}
                    {/* Quick status change buttons for Members */}
                    {!isCompleted && (
                      <div style={{ display:'flex', gap:4, marginBottom:8, flexWrap:'wrap' }}>
                        {STATUSES.filter(s => s !== status).map(s => (
                          <button key={s} className="btn btn-secondary btn-sm"
                            style={{ fontSize:10, padding:'2px 6px' }}
                            onClick={e => { e.stopPropagation(); handleStatusChange(task._id, s); }}>
                            → {s}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="kanban-task-footer">
                      <span className={`badge badge-${priorityClass[task.priority]}`}>{task.priority}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        {task.deadline && (
                          <span className={`task-deadline${isPast(new Date(task.deadline)) && task.status !== 'Done' ? ' overdue' : ''}`}>
                            {format(new Date(task.deadline), 'MMM d')}
                          </span>
                        )}
                        {task.assignedTo && (
                          <div className="member-avatar" style={{ width:22, height:22, fontSize:9 }} title={task.assignedTo.name}>
                            {task.assignedTo.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Submit button: only for the assigned member, only when not Done */}
                    {!isAdmin && task.assignedTo?._id === user?._id && task.status !== 'Done' && !isCompleted && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ marginTop:8, width:'100%', fontSize:12, background:'#22c55e', border:'none' }}
                        onClick={e => { e.stopPropagation(); openSubmitModal(task); }}>
                        ⬆ Submit Completed Work
                      </button>
                    )}
                    {/* Show submission count if any */}
                    {task.submissions?.length > 0 && (
                      <div style={{ marginTop:6, fontSize:11, color:'#22c55e', fontWeight:500 }}>
                        ✓ {task.submissions.length} submission{task.submissions.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                ))}
                {tasksByStatus[status]?.length === 0 && (
                  <div style={{ padding:'20px 0', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
                    No tasks
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="card">
          {tasks.length === 0 ? (
            <div className="empty-state"><p>No tasks yet.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Task</th><th>Status</th><th>Priority</th><th>Assigned To</th><th>Deadline</th><th>Submissions</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(t => (
                    <tr key={t._id}>
                      <td><div style={{ fontWeight:500 }}>{t.title}</div>
                        {t.description && <div className="text-muted text-sm">{t.description}</div>}
                      </td>
                      <td>
                        <select value={t.status}
                          onChange={e => handleStatusChange(t._id, e.target.value)}
                          disabled={isCompleted}
                          style={{ background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:6, padding:'4px 8px', color:'var(--text)', fontSize:12 }}>
                          {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td><span className={`badge badge-${priorityClass[t.priority]}`}>{t.priority}</span></td>
                      <td>{t.assignedTo?.name || <span className="text-muted">Unassigned</span>}</td>
                      <td>
                        {t.deadline ? (
                          <span className={isPast(new Date(t.deadline)) && t.status !== 'Done' ? 'task-deadline overdue' : 'task-deadline'}>
                            {format(new Date(t.deadline), 'MMM d, yyyy')}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {t.submissions?.length > 0 ? (
                          <div>
                            {t.submissions.map((s, i) => (
                              <div key={i} style={{ fontSize:11, marginBottom:4, padding:'4px 8px', background:'#22c55e11', borderRadius:5, border:'1px solid #22c55e33' }}>
                                <div style={{ color:'var(--text3)', fontSize:10 }}>{format(new Date(s.submittedAt), 'MMM d, h:mm a')}</div>
                                {s.fileUrl && (
                                  <a href={s.fileUrl} target="_blank" rel="noopener noreferrer"
                                    style={{ color:'#6366f1', fontSize:11 }}>🔗 View File</a>
                                )}
                                {s.notes && <div style={{ color:'var(--text2)', fontSize:11 }}>{s.notes}</div>}
                              </div>
                            ))}
                          </div>
                        ) : <span className="text-muted" style={{ fontSize:12 }}>—</span>}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:6 }}>
                          {!isCompleted && <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}>Edit</button>}
                          {(isAdmin || t.createdBy?._id === user?._id) && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(t._id)}>Del</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTaskModal(false)}>
          <div className="modal" style={{ maxWidth:520 }}>
            <div className="modal-header">
              <div className="modal-title">{selectedTask ? 'Edit Task' : 'New Task'}</div>
              <button className="modal-close" onClick={() => setShowTaskModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveTask}>
              <div className="form-group">
                <label>Title *</label>
                <input name="title" placeholder="Task title" value={taskForm.title}
                  onChange={e => setTaskForm(p => ({...p, title: e.target.value}))}/>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea name="description" placeholder="Task details..." value={taskForm.description}
                  onChange={e => setTaskForm(p => ({...p, description: e.target.value}))}/>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Status</label>
                  <select value={taskForm.status} onChange={e => setTaskForm(p => ({...p, status: e.target.value}))}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select value={taskForm.priority} onChange={e => setTaskForm(p => ({...p, priority: e.target.value}))}>
                    {PRIORITIES.map(pr => <option key={pr}>{pr}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Assign To</label>
                  <select value={taskForm.assignedTo} onChange={e => setTaskForm(p => ({...p, assignedTo: e.target.value}))}>
                    <option value="">Unassigned</option>
                    {project.members?.map(m => (
                      <option key={m.user._id} value={m.user._id}>{m.user.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Deadline</label>
                  <input type="date" value={taskForm.deadline}
                    onChange={e => setTaskForm(p => ({...p, deadline: e.target.value}))}/>
                </div>
              </div>
              <div className="form-group">
                <label>Tags (comma separated)</label>
                <input placeholder="frontend, bug, feature" value={taskForm.tags}
                  onChange={e => setTaskForm(p => ({...p, tags: e.target.value}))}/>
              </div>
              <div className="modal-footer">
                {selectedTask && (isAdmin || selectedTask.createdBy?._id === user?._id) && (
                  <button type="button" className="btn btn-danger" onClick={() => handleDeleteTask(selectedTask._id)}>Delete</button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : selectedTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Complete Confirmation Modal */}
      {showCompleteModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCompleteModal(false)}>
          <div className="modal" style={{ maxWidth:440 }}>
            <div className="modal-header">
              <div className="modal-title">Complete Project?</div>
              <button className="modal-close" onClick={() => setShowCompleteModal(false)}>×</button>
            </div>
            <div style={{ padding:'10px 0 20px' }}>
              <p style={{ color:'var(--text2)', marginBottom:14 }}>
                Are you sure you want to mark <strong>"{project.name}"</strong> as completed?
              </p>
              <div style={{ background:'var(--bg3)', borderRadius:8, padding:12, fontSize:13, color:'var(--text2)' }}>
                <div>✓ {doneTasks} tasks completed</div>
                {(totalTasks - doneTasks) > 0 && (
                  <div style={{ color:'#f59e0b' }}>⚠ {totalTasks - doneTasks} tasks still not done</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCompleteModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ background:'#22c55e' }} onClick={handleMarkProjectComplete}>
                ✓ Yes, Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Members Modal */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowMemberModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Manage Team Members</div>
              <button className="modal-close" onClick={() => setShowMemberModal(false)}>×</button>
            </div>
            <div className="section-title" style={{ fontSize:13, marginBottom:10 }}>Current Members</div>
            {project.members?.map(m => (
              <div key={m.user._id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <div className="member-avatar">{m.user.name?.charAt(0).toUpperCase()}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:500 }}>{m.user.name}</div>
                  <div className="text-muted text-sm">{m.user.email}</div>
                </div>
                <span className={`badge badge-${m.role==='Admin'?'admin':'member'}`}>{m.role}</span>
                {m.user._id !== project.owner._id && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m.user._id)}>Remove</button>
                )}
              </div>
            ))}
            {nonMembers.length > 0 && (
              <>
                <div className="section-title" style={{ fontSize:13, marginTop:20, marginBottom:10 }}>Add Members</div>
                {nonMembers.map(u => (
                  <div key={u._id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <div className="member-avatar">{u.name?.charAt(0).toUpperCase()}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:500 }}>{u.name}</div>
                      <div className="text-muted text-sm">{u.email} · {u.role}</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => handleAddMember(u._id)}>+ Add</button>
                  </div>
                ))}
              </>
            )}
            {nonMembers.length === 0 && project.members?.length > 0 && (
              <p className="text-muted text-sm" style={{ marginTop:10 }}>All registered users are already members.</p>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMemberModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {/* Submit Completed Work Modal - Members only */}
      {showSubmitModal && submitTask_target && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSubmitModal(false)}>
          <div className="modal" style={{ maxWidth:480 }}>
            <div className="modal-header">
              <div className="modal-title">⬆ Submit Completed Work</div>
              <button className="modal-close" onClick={() => setShowSubmitModal(false)}>×</button>
            </div>
            <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--bg3)', borderRadius:8 }}>
              <div style={{ fontWeight:600, fontSize:14 }}>{submitTask_target.title}</div>
              {submitTask_target.description && (
                <div style={{ fontSize:12, color:'var(--text2)', marginTop:4 }}>{submitTask_target.description}</div>
              )}
            </div>
            <form onSubmit={handleSubmitWork}>
              <div className="form-group">
                <label>File / Drive Link</label>
                <input
                  placeholder="https://drive.google.com/... or any file URL"
                  value={submitForm.fileUrl}
                  onChange={e => setSubmitForm(p => ({...p, fileUrl: e.target.value}))}
                />
                <small style={{ color:'var(--text3)', fontSize:11 }}>
                  Paste a Google Drive, Dropbox, GitHub, or any shareable link
                </small>
              </div>
              <div className="form-group">
                <label>Notes / Comments</label>
                <textarea
                  rows={4}
                  placeholder="Describe what you completed, any notes for the admin..."
                  value={submitForm.notes}
                  onChange={e => setSubmitForm(p => ({...p, notes: e.target.value}))}
                />
              </div>
              {/* Past submissions */}
              {submitTask_target.submissions?.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text2)', marginBottom:8 }}>
                    Previous Submissions ({submitTask_target.submissions.length})
                  </div>
                  {submitTask_target.submissions.map((s, i) => (
                    <div key={i} style={{ background:'var(--bg3)', borderRadius:6, padding:'8px 12px', marginBottom:6, fontSize:12 }}>
                      <div style={{ color:'var(--text3)' }}>
                        {format(new Date(s.submittedAt), 'MMM d, yyyy h:mm a')}
                      </div>
                      {s.fileUrl && (
                        <a href={s.fileUrl} target="_blank" rel="noopener noreferrer"
                          style={{ color:'#6366f1', wordBreak:'break-all' }}>🔗 {s.fileUrl}</a>
                      )}
                      {s.notes && <div style={{ color:'var(--text2)', marginTop:4 }}>{s.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSubmitModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}
                  style={{ background:'#22c55e' }}>
                  {submitting ? 'Submitting...' : '⬆ Submit Work'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
