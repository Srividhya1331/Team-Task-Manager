import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getProjects, createProject, updateProject, deleteProject } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#f97316','#ec4899'];
const PROJECT_STATUSES = ['Active','On Hold','Completed','Cancelled'];

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [form, setForm] = useState({ name:'', description:'', deadline:'', color:'#6366f1' });
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = () => {
    getProjects().then(r => setProjects(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => {
    setEditProject(null);
    setForm({ name:'', description:'', deadline:'', color:'#6366f1' });
    setShowModal(true);
  };

  const openEdit = (e, p) => {
    e.stopPropagation();
    setEditProject(p);
    setForm({
      name: p.name,
      description: p.description || '',
      deadline: p.deadline ? p.deadline.slice(0,10) : '',
      color: p.color || '#6366f1',
      status: p.status
    });
    setShowModal(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Project name is required');
    setSaving(true);
    try {
      if (editProject) {
        const res = await updateProject(editProject._id, form);
        setProjects(prev => prev.map(p => p._id === editProject._id ? { ...res.data, taskCounts: p.taskCounts } : p));
        toast.success('Project updated!');
      } else {
        const res = await createProject(form);
        setProjects(prev => [{ ...res.data, taskCounts:{ total:0 } }, ...prev]);
        toast.success('Project created!');
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const handleMarkComplete = async (e, p) => {
    e.stopPropagation();
    if (!window.confirm(`Mark "${p.name}" as Completed?`)) return;
    try {
      const res = await updateProject(p._id, { ...p, status: 'Completed' });
      setProjects(prev => prev.map(pr => pr._id === p._id ? { ...res.data, taskCounts: pr.taskCounts } : pr));
      toast.success('Project marked as Completed!');
    } catch (err) { toast.error('Failed to update status'); }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this project and all its tasks?')) return;
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p._id !== id));
      toast.success('Project deleted');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  };

  const statusColors = { Active:'#22c55e', Completed:'#6366f1', 'On Hold':'#f59e0b', Cancelled:'#ef4444' };

  if (loading) return <div className="loading-screen"><div className="spinner"/></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        {user?.role === 'Admin' && (
          <button className="btn btn-primary" onClick={openCreate}>+ New Project</button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <h3>No projects yet</h3>
          {user?.role === 'Admin'
            ? <p>Create your first project to get started</p>
            : <p>You haven't been added to any projects yet. Ask your Admin.</p>
          }
          {user?.role === 'Admin' && (
            <button className="btn btn-primary" onClick={openCreate}>+ Create Project</button>
          )}
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(p => (
            <div key={p._id} className="project-card" onClick={() => navigate(`/projects/${p._id}`)}>
              <div className="project-color-bar" style={{ background: p.color }}/>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                <div className="project-name">{p.name}</div>
                <span style={{
                  fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20,
                  background: statusColors[p.status]+'22', color: statusColors[p.status]
                }}>{p.status}</span>
              </div>
              <p className="project-desc">{p.description || 'No description'}</p>

              {/* Progress bar */}
              {p.taskCounts?.total > 0 && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text2)', marginBottom:4 }}>
                    <span>{p.taskCounts.Done || 0} / {p.taskCounts.total} tasks done</span>
                    <span>{Math.round(((p.taskCounts.Done||0)/p.taskCounts.total)*100)}%</span>
                  </div>
                  <div style={{ height:5, background:'var(--bg3)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{
                      height:'100%',
                      width: `${Math.round(((p.taskCounts.Done||0)/p.taskCounts.total)*100)}%`,
                      background: p.status === 'Completed' ? '#6366f1' : '#22c55e',
                      borderRadius:3, transition:'width .3s'
                    }}/>
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
                    {['Todo','In Progress','Review','Done'].map(s => p.taskCounts[s] > 0 && (
                      <span key={s} style={{ fontSize:10, color:'var(--text3)' }}>
                        {s}: {p.taskCounts[s]}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {p.deadline && (
                <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10 }}>
                  📅 Due {format(new Date(p.deadline), 'MMM d, yyyy')}
                </div>
              )}

              <div className="project-meta">
                <div className="project-members">
                  {p.members?.slice(0,4).map((m,i) => (
                    <div key={i} className="member-avatar" title={m.user?.name}>
                      {m.user?.name?.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {p.members?.length > 4 && <div className="member-avatar">+{p.members.length-4}</div>}
                  <span className="text-muted text-sm">{p.members?.length || 0} member{p.members?.length !== 1 ? 's':''}</span>
                </div>
                {user?.role === 'Admin' && (
                  <div style={{ display:'flex', gap:6 }} onClick={e => e.stopPropagation()}>
                    {p.status !== 'Completed' && (
                      <button className="btn btn-primary btn-sm" onClick={e => handleMarkComplete(e, p)}>✓ Complete</button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={e => openEdit(e, p)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={e => handleDelete(e, p._id)}>Del</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editProject ? 'Edit Project' : 'New Project'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Project Name *</label>
                <input name="name" placeholder="e.g. Website Redesign" value={form.name}
                  onChange={e => setForm(p => ({...p, name: e.target.value}))}/>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea name="description" placeholder="What's this project about?"
                  value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}/>
              </div>
              <div className="form-group">
                <label>Deadline</label>
                <input type="date" name="deadline" value={form.deadline}
                  onChange={e => setForm(p => ({...p, deadline: e.target.value}))}/>
              </div>
              {editProject && (
                <div className="form-group">
                  <label>Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))}>
                    {PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Color</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {COLORS.map(c => (
                    <div key={c} onClick={() => setForm(p => ({...p, color:c}))} style={{
                      width:28, height:28, borderRadius:'50%', background:c, cursor:'pointer',
                      border: form.color === c ? '3px solid #fff' : '3px solid transparent',
                      boxShadow: form.color === c ? '0 0 0 2px '+c : 'none'
                    }}/>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editProject ? 'Update Project' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
