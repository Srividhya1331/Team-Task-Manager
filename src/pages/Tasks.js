import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getTasks, updateTask, deleteTask } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { format, isPast } from 'date-fns';

const STATUSES = ['Todo', 'In Progress', 'Review', 'Done'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const priorityClass = { Low:'low', Medium:'medium', High:'high', Urgent:'urgent' };
const statusColors = { 'Todo':'#64748b', 'In Progress':'#6366f1', 'Review':'#f59e0b', 'Done':'#22c55e' };

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterMine, setFilterMine] = useState(false);
  const { user } = useAuth();

  const load = () => {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterPriority) params.priority = filterPriority;
    if (filterMine) params.assignedTo = user._id;
    getTasks(params).then(r => setTasks(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterStatus, filterPriority, filterMine]);

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await updateTask(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t._id === taskId ? res.data : t));
      if (newStatus === 'Done') toast.success('Task marked Done! ✓');
      else toast.success('Status updated');
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await deleteTask(id);
      setTasks(prev => prev.filter(t => t._id !== id));
      toast.success('Task deleted');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"/></div>;

  const doneTasks = tasks.filter(t => t.status === 'Done').length;
  const overdueTasks = tasks.filter(t => t.deadline && isPast(new Date(t.deadline)) && t.status !== 'Done').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{user?.role === 'Member' ? 'My Tasks' : 'All Tasks'}</h1>
          <p className="page-subtitle">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} · {doneTasks} done
            {overdueTasks > 0 && <span style={{ color:'#ef4444' }}> · {overdueTasks} overdue</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-row">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <button className={`btn ${filterMine ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterMine(p => !p)}>
          {filterMine ? '✓ My Tasks' : 'My Tasks'}
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <h3>No tasks found</h3>
          <p>{filterMine ? 'No tasks assigned to you.' : 'Try adjusting your filters'}</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assigned To</th>
                  <th>Deadline</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => {
                  const overdue = t.deadline && isPast(new Date(t.deadline)) && t.status !== 'Done';
                  const isMyTask = t.assignedTo?._id === user?._id;
                  return (
                    <tr key={t._id} style={{ background: isMyTask ? 'rgba(99,102,241,0.03)' : undefined }}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          {isMyTask && <span title="Assigned to you" style={{ fontSize:12 }}>👤</span>}
                          <div>
                            <div style={{ fontWeight:500 }}>{t.title}</div>
                            {t.tags?.length > 0 && (
                              <div className="tags" style={{ marginTop:4 }}>
                                {t.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {t.project ? (
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:8, height:8, borderRadius:'50%', background:t.project.color }}/>
                            <span className="text-sm">{t.project.name}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        <select value={t.status} onChange={e => handleStatusChange(t._id, e.target.value)}
                          style={{
                            background:'var(--bg3)', border:`1px solid ${statusColors[t.status]}44`,
                            borderRadius:6, padding:'4px 8px', color: statusColors[t.status], fontSize:12, fontWeight:500
                          }}>
                          {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td><span className={`badge badge-${priorityClass[t.priority]}`}>{t.priority}</span></td>
                      <td>
                        {t.assignedTo ? (
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div className="member-avatar" style={{ width:24, height:24, fontSize:10 }}>
                              {t.assignedTo.name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm">{t.assignedTo.name}</span>
                          </div>
                        ) : <span className="text-muted">Unassigned</span>}
                      </td>
                      <td>
                        {t.deadline ? (
                          <span style={{ color: overdue ? '#ef4444' : 'var(--text2)', fontSize:13 }}>
                            {overdue && '⚠ '}{format(new Date(t.deadline), 'MMM d, yyyy')}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {(user?.role === 'Admin' || t.createdBy?._id === user?._id) && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t._id)}>Delete</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
