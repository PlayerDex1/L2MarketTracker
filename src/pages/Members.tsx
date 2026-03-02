import { useState, useMemo } from 'react';
import { Search, Plus, Shield, ShieldAlert, User, Trash2, Swords, Filter, X, Edit2, ClipboardCheck, CheckSquare, Square, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useClanData } from '../contexts/ClanDataContext';

const CLASS_COLORS: Record<string, string> = {
  Tank: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Healer: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Buffer: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Melee DPS': 'bg-red-500/10 text-red-400 border-red-500/20',
  Archer: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Mage: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-blue-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function Members() {
  const { members, setMembers } = useClanData();

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [cpFilter, setCpFilter] = useState('All');

  const { member: currentUser } = useAuth();
  const canManageMembers = currentUser?.role === 'leader' || currentUser?.role === 'officer';
  const isLeader = currentUser?.role === 'leader';

  // Add Member Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);

  // Attendance Modal
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceSelected, setAttendanceSelected] = useState<Set<string>>(new Set());
  const [attendancePoints, setAttendancePoints] = useState(10);
  const [attendanceEvent, setAttendanceEvent] = useState('');

  const [newMember, setNewMember] = useState({
    in_game_name: '',
    class: '',
    class_group: 'Tank',
    level: 1,
    combat_power: 0,
    cp_name: ''
  });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `m${Date.now()}`;
    setMembers([...members, {
      id: newId,
      ...newMember,
      role: 'member',
      join_date: new Date().toISOString(),
      activity_points: 0,
      status: 'active'
    }]);
    setIsAddModalOpen(false);
    setNewMember({ in_game_name: '', class: '', class_group: 'Tank', level: 1, combat_power: 0, cp_name: '' });
  };

  const handleRemoveMember = (memberId: string) => {
    if (confirm('Are you sure you want to remove this member?')) {
      setMembers(members.filter(m => m.id !== memberId));
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMember) {
      setMembers(members.map(m => m.id === editingMember.id ? editingMember : m));
      setIsEditModalOpen(false);
      setEditingMember(null);
    }
  };

  // Attendance handlers
  const openAttendanceModal = () => {
    setAttendanceSelected(new Set());
    setAttendancePoints(10);
    setAttendanceEvent('');
    setIsAttendanceModalOpen(true);
  };

  const toggleAttendanceMember = (id: string) => {
    setAttendanceSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllAttendance = () => {
    const activeIds = filteredMembers.map(m => m.id);
    setAttendanceSelected(new Set(activeIds));
  };

  const handleRegisterAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (attendanceSelected.size === 0) return;
    setMembers(members.map(m =>
      attendanceSelected.has(m.id)
        ? { ...m, activity_points: m.activity_points + attendancePoints }
        : m
    ));
    setIsAttendanceModalOpen(false);
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesSearch = m.in_game_name.toLowerCase().includes(search.toLowerCase()) || m.class.toLowerCase().includes(search.toLowerCase());
      const matchesClass = classFilter === 'All' || m.class_group === classFilter;
      const matchesCp = cpFilter === 'All' || (cpFilter === 'Solo' ? !m.cp_name : (cpFilter === 'In CP' ? !!m.cp_name : m.cp_name === cpFilter));
      return matchesSearch && matchesClass && matchesCp;
    });
  }, [members, search, classFilter, cpFilter]);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'leader': return <ShieldAlert className="w-3.5 h-3.5 text-red-400" title="Leader" />;
      case 'officer': return <Shield className="w-3.5 h-3.5 text-indigo-400" title="Officer" />;
      default: return <User className="w-3.5 h-3.5 text-zinc-500" title="Member" />;
    }
  };

  const classGroups = ['All', ...Array.from(new Set(members.map(m => m.class_group)))];
  const cpOptions = ['All', 'In CP', 'Solo', ...Array.from(new Set(members.map(m => m.cp_name).filter(Boolean)))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Clan Roster</h1>
          <p className="text-zinc-400 mt-1">{members.length} members · {members.filter(m => m.status === 'active').length} active</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {canManageMembers && (
            <button
              onClick={openAttendanceModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-lg font-medium transition-colors"
            >
              <ClipboardCheck className="w-4 h-4" />
              Register Attendance
            </button>
          )}
          {canManageMembers && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Member
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search members or classes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-zinc-500 hidden sm:block" />
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="flex-1 sm:w-40 px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {classGroups.map(group => <option key={group} value={group}>{group === 'All' ? 'All Classes' : group}</option>)}
          </select>
          <select
            value={cpFilter}
            onChange={(e) => setCpFilter(e.target.value)}
            className="flex-1 sm:w-40 px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {cpOptions.map(cp => <option key={cp} value={cp}>{cp === 'All' ? 'All CPs' : cp}</option>)}
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      {filteredMembers.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">No members found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMembers.map((member) => {
            const avatarColor = getAvatarColor(member.in_game_name);
            const tendencyPct = Math.min(100, Math.max(0, member.activity_points));
            const tendencyColor = tendencyPct >= 75 ? 'bg-emerald-500' : tendencyPct >= 40 ? 'bg-amber-500' : 'bg-red-500';
            const classStyle = CLASS_COLORS[member.class_group] || 'bg-zinc-800 text-zinc-400 border-zinc-700';

            return (
              <div key={member.id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-600 transition-all hover:shadow-lg hover:shadow-black/20 group">
                {/* Card Top Bar */}
                <div className={`h-1 w-full ${avatarColor}`} />

                <div className="p-4 space-y-4">
                  {/* Avatar + Name + Role */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
                        {member.in_game_name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-zinc-100 leading-tight">{member.in_game_name}</span>
                          {getRoleIcon(member.role)}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          Joined {format(new Date(member.join_date), 'MMM yyyy')}
                        </div>
                      </div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${member.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                      {member.status}
                    </span>
                  </div>

                  {/* Class Badge + CP */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md border text-xs font-medium ${classStyle}`}>
                      {member.class}
                    </span>
                    {member.cp_name ? (
                      <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-xs font-medium">
                        {member.cp_name}
                      </span>
                    ) : (
                      <span className="text-zinc-600 text-xs italic">Solo</span>
                    )}
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-950/50 rounded-lg p-2.5">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Level</p>
                      <p className="text-lg font-bold text-zinc-100">{member.level}</p>
                    </div>
                    <div className="bg-zinc-950/50 rounded-lg p-2.5">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Combat Power</p>
                      <div className="flex items-center gap-1">
                        <Swords className="w-3 h-3 text-indigo-400" />
                        <p className="text-sm font-bold text-indigo-400">{member.combat_power.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Tendency */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Tendency</span>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span className="text-xs font-bold text-zinc-300">{member.activity_points} pts</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${tendencyColor}`} style={{ width: `${tendencyPct}%` }} />
                    </div>
                  </div>

                  {/* Actions */}
                  {canManageMembers && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/50">
                      <button
                        onClick={() => { setEditingMember(member); setIsEditModalOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                        title="Edit Member"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Remove Member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== ATTENDANCE MODAL ===== */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-zinc-100">Register Attendance</h2>
              </div>
              <button onClick={() => setIsAttendanceModalOpen(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterAttendance} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* Event name + points */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Event / Reason</label>
                    <input
                      type="text"
                      value={attendanceEvent}
                      onChange={e => setAttendanceEvent(e.target.value)}
                      placeholder="e.g. Antharas Kill"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Points to Award</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={attendancePoints}
                      onChange={e => setAttendancePoints(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Member list */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Select members present
                    </label>
                    <button
                      type="button"
                      onClick={attendanceSelected.size === filteredMembers.length ? () => setAttendanceSelected(new Set()) : selectAllAttendance}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {attendanceSelected.size === filteredMembers.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {members.map(m => {
                      const isChecked = attendanceSelected.has(m.id);
                      const avatarColor = getAvatarColor(m.in_game_name);
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => toggleAttendanceMember(m.id)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${isChecked
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700'
                            }`}
                        >
                          {isChecked
                            ? <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                            : <Square className="w-4 h-4 text-zinc-600 shrink-0" />
                          }
                          <div className={`w-7 h-7 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                            {m.in_game_name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-zinc-100 truncate">{m.in_game_name}</span>
                              {getRoleIcon(m.role)}
                            </div>
                            <div className="text-xs text-zinc-500">{m.class} · {m.activity_points} pts</div>
                          </div>
                          {isChecked && (
                            <span className="text-xs font-bold text-emerald-400 shrink-0">+{attendancePoints}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-zinc-800 shrink-0 flex items-center justify-between gap-3 bg-zinc-900">
                <div className="text-sm text-zinc-400">
                  {attendanceSelected.size > 0
                    ? <span className="text-emerald-400 font-medium">{attendanceSelected.size} member{attendanceSelected.size !== 1 ? 's' : ''} selected</span>
                    : <span className="text-zinc-600">No members selected</span>
                  }
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAttendanceModalOpen(false)}
                    className="px-4 py-2 text-zinc-400 hover:text-zinc-200 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={attendanceSelected.size === 0}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Confirm Attendance
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== ADD MEMBER MODAL ===== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-100">Add New Member</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">In-Game Name</label>
                <input
                  required type="text"
                  value={newMember.in_game_name}
                  onChange={e => setNewMember({ ...newMember, in_game_name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. HeroPlayer"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Class</label>
                  <input
                    required type="text"
                    value={newMember.class}
                    onChange={e => setNewMember({ ...newMember, class: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Paladin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Role Group</label>
                  <select
                    value={newMember.class_group}
                    onChange={e => setNewMember({ ...newMember, class_group: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Tank">Tank</option>
                    <option value="Healer">Healer</option>
                    <option value="Buffer">Buffer</option>
                    <option value="Melee DPS">Melee DPS</option>
                    <option value="Archer">Archer</option>
                    <option value="Mage">Mage</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Level</label>
                  <input
                    required type="number" min="1"
                    value={newMember.level}
                    onChange={e => setNewMember({ ...newMember, level: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Combat Power</label>
                  <input
                    required type="number" min="0"
                    value={newMember.combat_power}
                    onChange={e => setNewMember({ ...newMember, combat_power: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">CP Name (Optional)</label>
                <input
                  type="text"
                  value={newMember.cp_name}
                  onChange={e => setNewMember({ ...newMember, cp_name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Alpha Squad"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-zinc-400 hover:text-zinc-200 font-medium transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">Add Member</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== EDIT MEMBER MODAL ===== */}
      {isEditModalOpen && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-100">Edit Member</h2>
              <button onClick={() => { setIsEditModalOpen(false); setEditingMember(null); }} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">In-Game Name</label>
                <input
                  required type="text"
                  value={editingMember.in_game_name}
                  onChange={e => setEditingMember({ ...editingMember, in_game_name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Role (Cargo)</label>
                  <select
                    value={editingMember.role}
                    onChange={e => setEditingMember({ ...editingMember, role: e.target.value })}
                    disabled={!isLeader && editingMember.role === 'leader'}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    <option value="member">Member</option>
                    <option value="officer">Officer</option>
                    {isLeader && <option value="leader">Leader</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Status</label>
                  <select
                    value={editingMember.status}
                    onChange={e => setEditingMember({ ...editingMember, status: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Class</label>
                  <input
                    required type="text"
                    value={editingMember.class}
                    onChange={e => setEditingMember({ ...editingMember, class: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Level</label>
                  <input
                    required type="number" min="1"
                    value={editingMember.level}
                    onChange={e => setEditingMember({ ...editingMember, level: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Combat Power</label>
                  <input
                    required type="number" min="0"
                    value={editingMember.combat_power}
                    onChange={e => setEditingMember({ ...editingMember, combat_power: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">CP Name</label>
                  <input
                    type="text"
                    value={editingMember.cp_name || ''}
                    onChange={e => setEditingMember({ ...editingMember, cp_name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingMember(null); }} className="px-4 py-2 text-zinc-400 hover:text-zinc-200 font-medium transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
