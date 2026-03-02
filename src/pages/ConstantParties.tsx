import React, { useState, useMemo } from 'react';
import { Plus, Shield, Swords, ChevronDown, ChevronRight, Edit2, Trash2, UserPlus, X, ClipboardCheck, Crown, ArrowRight, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useClanData } from '../contexts/ClanDataContext';

const TOP_COLORS = ['bg-indigo-500', 'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
const AVATAR_COLORS = ['bg-indigo-500', 'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];

function getColorIndex(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % TOP_COLORS.length;
}
function getAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function ConstantParties() {
  const { member: currentUser } = useAuth();
  const { members, setMembers } = useClanData();
  const canManage = currentUser?.role === 'leader' || currentUser?.role === 'officer';

  const [cps, setCps] = useState<any[]>([
    { id: 'cp1', name: 'Alpha Squad', leader_id: 'm1', recruiting_classes: 'Bishop, Elven Elder', status: 'recruiting' },
    { id: 'cp2', name: 'Bravo Team', leader_id: 'm4', recruiting_classes: 'Paladin, Swordsinger', status: 'recruiting' },
  ]);

  const [expandedCp, setExpandedCp] = useState<string | null>('cp1');

  // Modals
  const [modal, setModal] = useState<'create' | 'edit' | 'addMember' | 'transfer' | 'attendance' | null>(null);
  const [selectedCpId, setSelectedCpId] = useState<string | null>(null);
  const [editingCp, setEditingCp] = useState<any>(null);

  // Forms
  const [cpForm, setCpForm] = useState({ name: '', leader_id: '', recruiting_classes: '', status: 'recruiting' });
  const [memberToAdd, setMemberToAdd] = useState('');
  const [newLeaderId, setNewLeaderId] = useState('');

  // Attendance
  const [attendanceSelected, setAttendanceSelected] = useState<Set<string>>(new Set());
  const [attendancePoints, setAttendancePoints] = useState(10);
  const [attendanceEvent, setAttendanceEvent] = useState('');

  // Derived
  const getCpMembers = (cpName: string) => members.filter(m => m.cp_name === cpName);
  const availableMembers = useMemo(() => members.filter(m => !m.cp_name), [members]);
  const selectedCp = cps.find(c => c.id === selectedCpId);

  const closeModal = () => { setModal(null); setSelectedCpId(null); setEditingCp(null); };

  // --- Handlers ---
  const handleCreateCp = (e: React.FormEvent) => {
    e.preventDefault();
    const newCp = { id: `cp${Date.now()}`, ...cpForm };
    if (cpForm.leader_id) {
      setMembers(prev => prev.map(m => m.id === cpForm.leader_id ? { ...m, cp_name: cpForm.name } : m));
    }
    setCps([...cps, newCp]);
    closeModal();
  };

  const handleEditCp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCp) return;
    if (editingCp.name !== cpForm.name) {
      setMembers(prev => prev.map(m => m.cp_name === editingCp.name ? { ...m, cp_name: cpForm.name } : m));
    }
    setCps(cps.map(cp => cp.id === editingCp.id ? { ...cp, ...cpForm } : cp));
    closeModal();
  };

  const handleDeleteCp = (cpId: string) => {
    const cp = cps.find(c => c.id === cpId);
    if (!cp || !confirm(`Delete "${cp.name}"? All members become Solo.`)) return;
    setMembers(prev => prev.map(m => m.cp_name === cp.name ? { ...m, cp_name: null } : m));
    setCps(cps.filter(c => c.id !== cpId));
  };

  const handleToggleStatus = (cpId: string) => {
    setCps(cps.map(cp => cp.id === cpId ? { ...cp, status: cp.status === 'recruiting' ? 'closed' : 'recruiting' } : cp));
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCp || !memberToAdd) return;
    setMembers(prev => prev.map(m => m.id === memberToAdd ? { ...m, cp_name: selectedCp.name } : m));
    setMemberToAdd('');
    closeModal();
  };

  const handleRemoveMember = (memberId: string) => {
    if (confirm('Remove this member from the CP?'))
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, cp_name: null } : m));
  };

  const handleTransferLeader = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCpId || !newLeaderId) return;
    setCps(cps.map(cp => cp.id === selectedCpId ? { ...cp, leader_id: newLeaderId } : cp));
    setNewLeaderId('');
    closeModal();
  };

  const openAttendance = (cpId: string) => {
    const cp = cps.find(c => c.id === cpId);
    if (!cp) return;
    setAttendanceSelected(new Set(getCpMembers(cp.name).map(m => m.id)));
    setAttendancePoints(10);
    setAttendanceEvent('');
    setSelectedCpId(cpId);
    setModal('attendance');
  };

  const handleAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    setMembers(prev => prev.map(m => attendanceSelected.has(m.id) ? { ...m, activity_points: m.activity_points + attendancePoints } : m));
    closeModal();
  };

  const toggleAttendanceMember = (id: string) => {
    setAttendanceSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">CP Management</h1>
          <p className="text-zinc-400 mt-1">Organize Constant Parties, leaders, and members.</p>
        </div>
        {canManage && (
          <button onClick={() => { setCpForm({ name: '', leader_id: '', recruiting_classes: '', status: 'recruiting' }); setModal('create'); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
            <Plus className="w-4 h-4" /> Create CP
          </button>
        )}
      </div>

      {/* CP Cards */}
      {cps.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 bg-zinc-900/50 border border-zinc-800 rounded-xl">No Constant Parties found.</div>
      ) : (
        <div className="space-y-4">
          {cps.map((cp) => {
            const cpMembers = getCpMembers(cp.name);
            const totalCp = cpMembers.reduce((s, m) => s + (m.combat_power || 0), 0);
            const avgLevel = cpMembers.length > 0 ? Math.round(cpMembers.reduce((s, m) => s + m.level, 0) / cpMembers.length) : 0;
            const isExpanded = expandedCp === cp.id;
            const leader = members.find(m => m.id === cp.leader_id);
            const ci = getColorIndex(cp.name);

            return (
              <div key={cp.id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
                <div className={`h-1 w-full ${TOP_COLORS[ci]}`} />

                <div className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">

                    {/* Name + expand */}
                    <button onClick={() => setExpandedCp(isExpanded ? null : cp.id)} className="flex items-center gap-3 flex-1 text-left">
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-zinc-500 shrink-0" /> : <ChevronRight className="w-5 h-5 text-zinc-500 shrink-0" />}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-bold text-zinc-100">{cp.name}</h2>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-xs font-medium">{cpMembers.length}/9</span>
                          {/* Status toggle */}
                          {canManage ? (
                            <button onClick={(e) => { e.stopPropagation(); handleToggleStatus(cp.id); }}
                              className={`px-2 py-0.5 rounded-md text-xs font-bold transition-colors border ${cp.status === 'recruiting' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700'}`}>
                              {cp.status === 'recruiting' ? '🟢 Recruiting' : '🔒 Closed'}
                            </button>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${cp.status === 'recruiting' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                              {cp.status === 'recruiting' ? '🟢 Recruiting' : '🔒 Closed'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-400 mt-1 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Leader: <span className="text-zinc-200 font-medium ml-1">{leader?.in_game_name || 'None'}</span>
                        </p>
                      </div>
                    </button>

                    {/* Stats */}
                    <div className="flex items-center gap-5 ml-8 lg:ml-0">
                      {cp.status === 'recruiting' && cp.recruiting_classes && (
                        <div className="hidden md:block">
                          <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Recruiting</p>
                          <div className="flex flex-wrap gap-1">
                            {cp.recruiting_classes.split(',').map((cls: string) => (
                              <span key={cls} className="px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800/50 text-zinc-300 text-[11px]">{cls.trim()}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Avg Lvl</p>
                        <p className="text-lg font-bold text-zinc-100">{avgLevel || '—'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Total CP</p>
                        <div className="flex items-center gap-1">
                          <Swords className="w-3.5 h-3.5 text-indigo-400" />
                          <p className="text-lg font-bold text-indigo-400">{totalCp.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {canManage && (
                      <div className="flex items-center gap-1.5 ml-8 lg:ml-0 flex-wrap">
                        <button onClick={() => openAttendance(cp.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded-lg border border-emerald-500/20 transition-colors">
                          <ClipboardCheck className="w-3.5 h-3.5" /> Attendance
                        </button>
                        <button onClick={() => { setSelectedCpId(cp.id); setNewLeaderId(''); setModal('transfer'); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 rounded-lg border border-amber-500/20 transition-colors">
                          <Crown className="w-3.5 h-3.5" /> Transfer
                        </button>
                        <button onClick={() => { setEditingCp(cp); setCpForm({ name: cp.name, leader_id: cp.leader_id, recruiting_classes: cp.recruiting_classes, status: cp.status }); setModal('edit'); }}
                          className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteCp(cp.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded member table */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 bg-zinc-950/50">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-zinc-500 uppercase text-xs font-medium bg-zinc-900/30">
                          <tr>
                            <th className="px-6 py-3">Member</th>
                            <th className="px-6 py-3">Class</th>
                            <th className="px-6 py-3 text-center">Level</th>
                            <th className="px-6 py-3 text-right">Combat Power</th>
                            <th className="px-6 py-3 text-center">Tendency</th>
                            {canManage && <th className="px-6 py-3 text-right">Actions</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {cpMembers.map((m: any) => (
                            <tr key={m.id} className="hover:bg-zinc-800/30 transition-colors">
                              <td className="px-6 py-3 font-medium text-zinc-200">
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-full ${getAvatarColor(m.in_game_name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                    {m.in_game_name.charAt(0)}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {m.id === cp.leader_id && <Crown className="w-3 h-3 text-amber-400" title="CP Leader" />}
                                    {m.in_game_name}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-3 text-zinc-400">{m.class}</td>
                              <td className="px-6 py-3 text-center font-medium text-zinc-300">{m.level}</td>
                              <td className="px-6 py-3 text-right font-bold text-indigo-400">{m.combat_power?.toLocaleString()}</td>
                              <td className="px-6 py-3 text-center text-xs font-bold text-zinc-300">{m.activity_points} pts</td>
                              {canManage && (
                                <td className="px-6 py-3 text-right">
                                  <button onClick={() => handleRemoveMember(m.id)} className="text-zinc-500 hover:text-red-400 text-xs transition-colors">Remove</button>
                                </td>
                              )}
                            </tr>
                          ))}
                          {cpMembers.length === 0 && (
                            <tr><td colSpan={canManage ? 6 : 5} className="px-6 py-8 text-center text-zinc-500">No members yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {canManage && cpMembers.length < 9 && (
                      <div className="p-3 border-t border-zinc-800/50">
                        <button onClick={() => { setSelectedCpId(cp.id); setMemberToAdd(''); setModal('addMember'); }}
                          className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/50 transition-colors flex items-center justify-center gap-2">
                          <UserPlus className="w-4 h-4" /> Add Member to {cp.name}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===== MODALS ===== */}
      {/* Create / Edit CP */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-100">{modal === 'edit' ? 'Edit CP' : 'Create CP'}</h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={modal === 'edit' ? handleEditCp : handleCreateCp} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">CP Name</label>
                <input required type="text" value={cpForm.name} onChange={e => setCpForm({ ...cpForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Alpha Squad" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Status</label>
                <select value={cpForm.status} onChange={e => setCpForm({ ...cpForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="recruiting">🟢 Recruiting</option>
                  <option value="closed">🔒 Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Recruiting Classes</label>
                <input type="text" value={cpForm.recruiting_classes} onChange={e => setCpForm({ ...cpForm, recruiting_classes: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Bishop, Swordsinger" />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
                  {modal === 'edit' ? 'Save Changes' : 'Create CP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member */}
      {modal === 'addMember' && selectedCp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-100">Add Member to {selectedCp.name}</h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddMember} className="p-4 space-y-4">
              {availableMembers.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 shrink-0" /> All members are already in a CP.
                </div>
              ) : (
                <select required value={memberToAdd} onChange={e => setMemberToAdd(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">-- Select a member --</option>
                  {availableMembers.map(m => <option key={m.id} value={m.id}>{m.in_game_name} – {m.class} (Lvl {m.level})</option>)}
                </select>
              )}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
                <button type="submit" disabled={availableMembers.length === 0 || !memberToAdd}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Leader */}
      {modal === 'transfer' && selectedCp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-zinc-100">Transfer Leader</h2>
              </div>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleTransferLeader} className="p-4 space-y-4">
              <p className="text-sm text-zinc-400">Select new leader for <span className="text-zinc-100 font-medium">{selectedCp.name}</span>.</p>
              {getCpMembers(selectedCp.name).filter(m => m.id !== selectedCp.leader_id).length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 shrink-0" /> Need at least 2 members to transfer leadership.
                </div>
              ) : (
                <select required value={newLeaderId} onChange={e => setNewLeaderId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">-- Select new leader --</option>
                  {getCpMembers(selectedCp.name).filter(m => m.id !== selectedCp.leader_id).map(m => (
                    <option key={m.id} value={m.id}>{m.in_game_name} – {m.class}</option>
                  ))}
                </select>
              )}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
                <button type="submit" disabled={!newLeaderId}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ArrowRight className="w-4 h-4" /> Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CP Attendance */}
      {modal === 'attendance' && selectedCp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-zinc-100">Attendance – {selectedCp.name}</h2>
              </div>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAttendance} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Event / Reason</label>
                    <input type="text" value={attendanceEvent} onChange={e => setAttendanceEvent(e.target.value)}
                      placeholder="e.g. Antharas Kill"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Points to Award</label>
                    <input type="number" required min={1} value={attendancePoints} onChange={e => setAttendancePoints(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Members present</label>
                    <button type="button" onClick={() => {
                      const ids = getCpMembers(selectedCp.name).map(m => m.id);
                      setAttendanceSelected(attendanceSelected.size === ids.length ? new Set() : new Set(ids));
                    }} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                      {attendanceSelected.size === getCpMembers(selectedCp.name).length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {getCpMembers(selectedCp.name).map(m => {
                      const checked = attendanceSelected.has(m.id);
                      return (
                        <button type="button" key={m.id} onClick={() => toggleAttendanceMember(m.id)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${checked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700'}`}>
                          {checked ? <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" /> : <Square className="w-4 h-4 text-zinc-600 shrink-0" />}
                          <div className={`w-7 h-7 rounded-full ${getAvatarColor(m.in_game_name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                            {m.in_game_name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-zinc-100">{m.in_game_name}</div>
                            <div className="text-xs text-zinc-500">{m.class} · {m.activity_points} pts</div>
                          </div>
                          {checked && <span className="text-xs font-bold text-emerald-400 shrink-0">+{attendancePoints}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-zinc-800 shrink-0 flex items-center justify-between bg-zinc-900">
                <span className="text-sm">
                  {attendanceSelected.size > 0
                    ? <span className="text-emerald-400 font-medium">{attendanceSelected.size} selected</span>
                    : <span className="text-zinc-600">None selected</span>}
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
                  <button type="submit" disabled={attendanceSelected.size === 0}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Confirm Attendance
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
