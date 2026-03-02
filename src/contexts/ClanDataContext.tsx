import { createContext, useContext, useState, ReactNode } from 'react';

export interface Member {
    id: string;
    in_game_name: string;
    role: 'leader' | 'officer' | 'member';
    join_date: string;
    cp_name: string | null;
    class: string;
    class_group: string;
    level: number;
    combat_power: number;
    activity_points: number;
    status: 'active' | 'inactive';
}

const INITIAL_MEMBERS: Member[] = [
    { id: 'm1', in_game_name: 'AdminPlayer', role: 'leader', join_date: '2023-01-15T00:00:00Z', cp_name: 'Alpha Squad', class: 'Paladin', class_group: 'Tank', level: 85, combat_power: 45000, activity_points: 120, status: 'active' },
    { id: 'm2', in_game_name: 'HealMePls', role: 'officer', join_date: '2023-02-20T00:00:00Z', cp_name: 'Alpha Squad', class: 'Bishop', class_group: 'Healer', level: 84, combat_power: 42000, activity_points: 85, status: 'active' },
    { id: 'm3', in_game_name: 'StabbyStab', role: 'member', join_date: '2023-03-10T00:00:00Z', cp_name: null, class: 'Treasure Hunter', class_group: 'Melee DPS', level: 82, combat_power: 38000, activity_points: 15, status: 'inactive' },
    { id: 'm4', in_game_name: 'BowMaster', role: 'member', join_date: '2023-04-01T00:00:00Z', cp_name: 'Bravo Team', class: 'Hawkeye', class_group: 'Archer', level: 83, combat_power: 40000, activity_points: 60, status: 'active' },
    { id: 'm5', in_game_name: 'SingForMe', role: 'member', join_date: '2023-04-15T00:00:00Z', cp_name: 'Bravo Team', class: 'Swordsinger', class_group: 'Buffer', level: 81, combat_power: 35000, activity_points: 45, status: 'active' },
    { id: 'm6', in_game_name: 'NukeEmAll', role: 'member', join_date: '2023-05-01T00:00:00Z', cp_name: null, class: 'Spellsinger', class_group: 'Mage', level: 84, combat_power: 43000, activity_points: 70, status: 'active' },
    { id: 'm7', in_game_name: 'BuffMeUp', role: 'member', join_date: '2023-05-10T00:00:00Z', cp_name: null, class: 'Prophet', class_group: 'Buffer', level: 80, combat_power: 32000, activity_points: 30, status: 'active' },
    { id: 'm8', in_game_name: 'ShadowStep', role: 'member', join_date: '2023-05-20T00:00:00Z', cp_name: null, class: 'Abyss Walker', class_group: 'Melee DPS', level: 82, combat_power: 39000, activity_points: 55, status: 'active' },
];

interface ClanDataContextType {
    members: Member[];
    setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
}

const ClanDataContext = createContext<ClanDataContextType | undefined>(undefined);

export function ClanDataProvider({ children }: { children: ReactNode }) {
    const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
    return (
        <ClanDataContext.Provider value={{ members, setMembers }}>
            {children}
        </ClanDataContext.Provider>
    );
}

export const useClanData = () => {
    const ctx = useContext(ClanDataContext);
    if (!ctx) throw new Error('useClanData must be used within ClanDataProvider');
    return ctx;
};
