import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getUsers, updateUser, deleteUser } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    getUsers().then(r => setUsers(r.data)).finally(() => setLoading(false));
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await updateUser(userId, { role: newRole });
      setUsers(prev => prev.map(u => u._id === userId ? res.data : u));
      toast.success('Role updated');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update role'); }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Delete this user permanently?')) return;
    try {
      await deleteUser(userId);
      setUsers(prev => prev.filter(u => u._id !== userId));
      toast.success('User deleted');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="user-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.name}</div>
                        {u._id === currentUser._id && (
                          <span style={{ fontSize: 11, color: 'var(--accent2)' }}>You</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="text-muted">{u.email}</td>
                  <td>
                    {u._id === currentUser._id ? (
                      <span className={`badge badge-${u.role === 'Admin' ? 'admin' : 'member'}`}>{u.role}</span>
                    ) : (
                      <select value={u.role} onChange={e => handleRoleChange(u._id, e.target.value)}
                        style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 10px', color: 'var(--text)', fontSize: 13 }}>
                        <option>Member</option>
                        <option>Admin</option>
                      </select>
                    )}
                  </td>
                  <td className="text-muted text-sm">
                    {u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : '—'}
                  </td>
                  <td>
                    {u._id !== currentUser._id && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u._id)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
