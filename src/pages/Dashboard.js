import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, getProjects, getTasks } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { format, isPast } from 'date-fns';

const priorityClass = { Low:'low', Medium:'medium', High:'high', Urgent:'urgent' };
const statusColors = { 'Todo':'#64748b', 'In Progress':'#6366f1', 'Review':'#f59e0b', 'Done':'#22c55e' };

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getDashboardStats(), getProjects(), getTasks()])
      .then(([s, p, t]) => {
        setStats(s.data);
        setProjects(p.data.slice(0,4));
        const all = t.data;
        setRecentTasks(all.slice(0,5));
        setMyTasks(all.filter(task => task.assignedTo?._id === user?._id).slice(0,5));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-screen"><div className="spinner"/></div>;

  const statCards = [
    { label:'Total Projects', value: stats?.totalProjects || 0, color:'#6366f1', bg:'rgba(99,102,241,0.1)', icon:'📁' },
    { label:'Total Tasks',    value: stats?.totalTasks    || 0, color:'#22c55e', bg:'rgba(34,197,94,0.1)',  icon:'✅' },
    { label:'My Tasks',       value: stats?.myTasks       || 0, color:'#f59e0b', bg:'rgba(245,158,11,0.1)', icon:'👤' },
    { label:'Overdue',        value: stats?.overdueTasks  || 0, color:'#ef4444', bg:'rgba(239,68,68,0.1)',  icon:'⚠️' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">
            {user?.role === 'Admin'
              ? 'Manage your projects and track your team\'s progress'
              : 'Here are your tasks and project updates'}
          </p>
        </div>
        {user?.role === 'Admin' && (
          <button className="btn btn-primary" onClick={() => navigate('/projects')}>
            + New Project
          </button>
        )}
      </div>

      {/* Role banner */}
      <div style={{
        background: user?.role === 'Admin' ? 'rgba(99,102,241,0.08)' : 'rgba(34,197,94,0.08)',
        border: `1px solid ${user?.role === 'Admin' ? 'rgba(99,102,241,0.2)' : 'rgba(34,197,94,0.2)'}`,
        borderRadius:10, padding:'12px 18px', marginBottom:24,
        display:'flex', alignItems:'center', gap:12
      }}>
        <span style={{ fontSize:22 }}>{user?.role === 'Admin' ? '🛡️' : '👷'}</span>
        <div>
          <div style={{ fontWeight:600, fontSize:14, color: user?.role === 'Admin' ? '#6366f1' : '#22c55e' }}>
            {user?.role === 'Admin' ? 'Admin Account' : 'Member Account'}
          </div>
          <div style={{ fontSize:12, color:'var(--text2)' }}>
            {user?.role === 'Admin'
              ? 'You can create projects, add members, assign tasks and mark projects complete.'
              : 'You can view your assigned tasks, update task status and add comments.'}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {statCards.map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon" style={{ background:s.bg, fontSize:20 }}>{s.icon}</div>
            <div className="stat-value" style={{ color:s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      {stats?.byStatus && (
        <div className="card" style={{ marginBottom:24 }}>
          <div className="section-title">Task Status Breakdown</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            {Object.entries(statusColors).map(([key, color]) => {
              const count = stats.byStatus[key] || 0;
              const pct = stats.totalTasks > 0 ? Math.round((count/stats.totalTasks)*100) : 0;
              return (
                <div key={key}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span className="text-sm text-muted">{key}</span>
                    <span className="text-sm" style={{ color, fontWeight:600 }}>{count}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width:`${pct}%`, background:color }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* Projects */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div className="section-title" style={{ marginBottom:0 }}>
              {user?.role === 'Admin' ? 'My Projects' : 'My Projects'}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/projects')}>View all</button>
          </div>
          {projects.length === 0 ? (
            <div className="empty-state">
              <p>{user?.role === 'Admin' ? 'No projects yet. Create one!' : 'You have not been added to any project yet.'}</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {projects.map(p => {
                const done = p.taskCounts?.Done || 0;
                const total = p.taskCounts?.total || 0;
                const pct = total > 0 ? Math.round((done/total)*100) : 0;
                return (
                  <div key={p._id} className="card" style={{ cursor:'pointer', padding:14 }}
                    onClick={() => navigate(`/projects/${p._id}`)}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:p.color, flexShrink:0 }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:14 }}>{p.name}</div>
                        <div className="text-muted text-sm">{total} tasks · {p.members?.length||0} members</div>
                      </div>
                      <span style={{
                        fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20,
                        background: p.status==='Completed' ? '#6366f122':'#22c55e22',
                        color: p.status==='Completed'?'#6366f1':'#22c55e'
                      }}>{p.status}</span>
                    </div>
                    {total > 0 && (
                      <div>
                        <div style={{ height:4, background:'var(--bg3)', borderRadius:2, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background: p.status==='Completed'?'#6366f1':'#22c55e', borderRadius:2 }}/>
                        </div>
                        <div className="text-muted" style={{ fontSize:11, marginTop:4 }}>{pct}% complete</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div className="section-title" style={{ marginBottom:0 }}>
              {user?.role === 'Member' ? 'My Assigned Tasks' : 'Recent Tasks'}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/tasks')}>View all</button>
          </div>
          {(user?.role === 'Member' ? myTasks : recentTasks).length === 0 ? (
            <div className="empty-state">
              <p>{user?.role === 'Member' ? 'No tasks assigned to you yet.' : 'No tasks yet.'}</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(user?.role === 'Member' ? myTasks : recentTasks).map(t => {
                const overdue = t.deadline && isPast(new Date(t.deadline)) && t.status !== 'Done';
                return (
                  <div key={t._id} className="task-item" style={{ borderLeft:`3px solid ${statusColors[t.status]}` }}>
                    <div className="task-title">{t.title}</div>
                    {t.project && (
                      <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>
                        📁 {t.project.name}
                      </div>
                    )}
                    <div className="task-meta">
                      <span className={`badge badge-${priorityClass[t.priority]}`}>{t.priority}</span>
                      <span style={{
                        fontSize:11, padding:'1px 6px', borderRadius:10,
                        background: statusColors[t.status]+'22', color: statusColors[t.status], fontWeight:500
                      }}>{t.status}</span>
                      {t.deadline && (
                        <span style={{ fontSize:11, color: overdue?'#ef4444':'var(--text3)' }}>
                          {overdue && '⚠ '}{format(new Date(t.deadline), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
