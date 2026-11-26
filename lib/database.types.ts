// Generado desde Supabase (generate_typescript_types). Regenerar tras cada migración.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type FixtureRow = {
  away_goals: number | null
  away_team: string
  away_team_id: string | null
  club_team_id: string
  competition: string
  created_at: string
  home_goals: number | null
  home_team: string
  home_team_id: string | null
  id: string
  kickoff_at: string
  locked_at: string | null
  round_id: string
  status: Database['public']['Enums']['fixture_status']
  updated_at: string
}

type PredictionRow = {
  away_goals: number
  created_at: string
  fixture_id: string
  home_goals: number
  id: string
  updated_at: string
  user_id: string
}

type SettlementRow = {
  admin_fee_total_cents: number
  contribution_total_cents: number
  entry_fee_cents: number
  kind: Database['public']['Enums']['settlement_kind']
  participants_count: number
  pot_after_cents: number
  pot_before_cents: number
  pot_contribution_cents: number
  pot_in_play_cents: number
  reason: string | null
  round_id: string
  settled_at: string
  settled_by: string | null
  share_cents: number
  winners_count: number
}

type Rel = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' }
  public: {
    Tables: {
      fixtures: {
        Row: FixtureRow
        Insert: Partial<FixtureRow> & Pick<FixtureRow, 'away_team' | 'club_team_id' | 'competition' | 'home_team' | 'kickoff_at' | 'round_id'>
        Update: Partial<FixtureRow>
        Relationships: [
          { foreignKeyName: 'fixtures_round_id_fkey'; columns: ['round_id']; isOneToOne: false; referencedRelation: 'rounds'; referencedColumns: ['id'] },
          { foreignKeyName: 'fixtures_club_team_id_fkey'; columns: ['club_team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
          { foreignKeyName: 'fixtures_home_team_id_fkey'; columns: ['home_team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
          { foreignKeyName: 'fixtures_away_team_id_fkey'; columns: ['away_team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          is_active: boolean
          league_id: string
          max_uses: number | null
          note: string | null
          used_count: number
        }
        Insert: never
        Update: never
        Relationships: Rel[]
      }
      pot_movements: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          id: number
          kind: Database['public']['Enums']['pot_movement_kind']
          league_id: string
          note: string | null
          round_id: string | null
          user_id: string | null
        }
        Insert: never
        Update: never
        Relationships: [
          { foreignKeyName: 'pot_movements_round_id_fkey'; columns: ['round_id']; isOneToOne: false; referencedRelation: 'rounds'; referencedColumns: ['id'] },
          { foreignKeyName: 'pot_movements_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
      prediction_log: {
        Row: {
          action: string
          away_goals: number | null
          created_at: string
          fixture_id: string
          home_goals: number | null
          id: number
          user_id: string
        }
        Insert: never
        Update: never
        Relationships: [
          { foreignKeyName: 'prediction_log_fixture_id_fkey'; columns: ['fixture_id']; isOneToOne: false; referencedRelation: 'fixtures'; referencedColumns: ['id'] },
          { foreignKeyName: 'prediction_log_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
      predictions: {
        Row: PredictionRow
        Insert: never
        Update: never
        Relationships: [
          { foreignKeyName: 'predictions_fixture_id_fkey'; columns: ['fixture_id']; isOneToOne: false; referencedRelation: 'fixtures'; referencedColumns: ['id'] },
          { foreignKeyName: 'predictions_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          created_at: string
          display_name: string
          id: string
          invite_code: string | null
          role: Database['public']['Enums']['app_role']
          status: Database['public']['Enums']['member_status']
        }
        Insert: never
        Update: never
        Relationships: []
      }
      round_settlements: {
        Row: SettlementRow
        Insert: never
        Update: never
        Relationships: [
          { foreignKeyName: 'round_settlements_round_id_fkey'; columns: ['round_id']; isOneToOne: true; referencedRelation: 'rounds'; referencedColumns: ['id'] },
        ]
      }
      round_winners: {
        Row: { created_at: string; round_id: string; share_cents: number; user_id: string }
        Insert: never
        Update: never
        Relationships: [
          { foreignKeyName: 'round_winners_round_id_fkey'; columns: ['round_id']; isOneToOne: false; referencedRelation: 'rounds'; referencedColumns: ['id'] },
          { foreignKeyName: 'round_winners_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
      rounds: {
        Row: {
          created_at: string
          id: string
          league_id: string
          name: string
          number: number
          season_id: string
          status: Database['public']['Enums']['round_status']
        }
        Insert: { league_id: string; name: string; number: number; season_id: string; status?: Database['public']['Enums']['round_status'] }
        Update: { name?: string; number?: number; status?: Database['public']['Enums']['round_status'] }
        Relationships: [
          { foreignKeyName: 'rounds_season_id_fkey'; columns: ['season_id']; isOneToOne: false; referencedRelation: 'seasons'; referencedColumns: ['id'] },
          { foreignKeyName: 'rounds_league_id_fkey'; columns: ['league_id']; isOneToOne: false; referencedRelation: 'leagues'; referencedColumns: ['id'] },
        ]
      }
      teams: {
        Row: { id: string; name: string; short_name: string | null; crest_url: string | null; created_at: string }
        Insert: { name: string; short_name?: string | null; crest_url?: string | null }
        Update: { name?: string; short_name?: string | null; crest_url?: string | null }
        Relationships: []
      }
      leagues: {
        Row: { id: string; name: string; club_a_id: string; club_b_id: string; is_active: boolean; created_at: string }
        Insert: { name: string; club_a_id: string; club_b_id: string; is_active?: boolean }
        Update: { name?: string; club_a_id?: string; club_b_id?: string; is_active?: boolean }
        Relationships: [
          { foreignKeyName: 'leagues_club_a_id_fkey'; columns: ['club_a_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
          { foreignKeyName: 'leagues_club_b_id_fkey'; columns: ['club_b_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
        ]
      }
      league_members: {
        Row: {
          league_id: string
          user_id: string
          status: Database['public']['Enums']['member_status']
          invite_code: string | null
          joined_at: string
          approved_at: string | null
        }
        Insert: never
        Update: never
        Relationships: [
          { foreignKeyName: 'league_members_league_id_fkey'; columns: ['league_id']; isOneToOne: false; referencedRelation: 'leagues'; referencedColumns: ['id'] },
          { foreignKeyName: 'league_members_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          entry_fee_cents: number
          id: string
          is_active: boolean
          name: string
          pot_contribution_cents: number
        }
        Insert: { name: string; is_active?: boolean; entry_fee_cents?: number; pot_contribution_cents?: number }
        Update: { name?: string; is_active?: boolean; entry_fee_cents?: number; pot_contribution_cents?: number }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      admin_adjust_pot: { Args: { p_league_id: string; p_amount_cents: number; p_note: string }; Returns: number }
      admin_create_invite_code: { Args: { p_league_id: string; p_expires_at?: string; p_max_uses?: number; p_note?: string }; Returns: string }
      admin_list_members: {
        Args: { p_league_id?: string }
        Returns: {
          league_id: string
          league_name: string
          user_id: string
          display_name: string
          email: string
          role: Database['public']['Enums']['app_role']
          member_status: Database['public']['Enums']['member_status']
          account_status: Database['public']['Enums']['member_status']
          invite_code: string | null
          joined_at: string
          approved_at: string | null
        }[]
      }
      admin_reopen_round: { Args: { p_round_id: string }; Returns: undefined }
      admin_replace_fixture: {
        Args: {
          p_away_team: string
          p_competition: string
          p_fixture_id: string
          p_home_team: string
          p_kickoff_at: string
          p_home_team_id?: string | null
          p_away_team_id?: string | null
        }
        Returns: FixtureRow
        SetofOptions: { from: '*'; to: 'fixtures'; isOneToOne: true; isSetofReturn: false }
      }
      admin_set_invite_code_active: { Args: { p_active: boolean; p_code: string }; Returns: undefined }
      admin_set_member_role: { Args: { p_role: Database['public']['Enums']['app_role']; p_user_id: string }; Returns: undefined }
      admin_set_membership: {
        Args: { p_league_id: string; p_user_id: string; p_status: Database['public']['Enums']['member_status'] }
        Returns: undefined
      }
      admin_set_account_status: { Args: { p_user_id: string; p_status: Database['public']['Enums']['member_status'] }; Returns: undefined }
      admin_settle_round: {
        Args: { p_round_id: string }
        Returns: SettlementRow
        SetofOptions: { from: '*'; to: 'round_settlements'; isOneToOne: true; isSetofReturn: false }
      }
      admin_void_round: {
        Args: { p_reason: string; p_round_id: string }
        Returns: SettlementRow
        SetofOptions: { from: '*'; to: 'round_settlements'; isOneToOne: true; isSetofReturn: false }
      }
      check_invite_code: { Args: { p_code: string }; Returns: boolean }
      get_leaderboard: {
        Args: { p_league_id: string; p_season_id?: string }
        Returns: { display_name: string; exact_hits: number; rounds_played: number; total_won_cents: number; user_id: string; wins: number }[]
      }
      get_pot_balance: { Args: { p_league_id: string }; Returns: number }
      get_round_pot: {
        Args: { p_round_id: string }
        Returns: { contribution_cents: number; is_closed: boolean; participants_count: number; pot_before_cents: number; pot_in_play_cents: number }[]
      }
      get_round_submissions: {
        Args: { p_round_id: string }
        Returns: { display_name: string; submitted_count: number; user_id: string }[]
      }
      submit_prediction: {
        Args: { p_away_goals: number; p_fixture_id: string; p_home_goals: number }
        Returns: PredictionRow
        SetofOptions: { from: '*'; to: 'predictions'; isOneToOne: true; isSetofReturn: false }
      }
      redeem_invite_code: { Args: { p_code: string }; Returns: string }
      update_my_display_name: { Args: { p_display_name: string }; Returns: undefined }
    }
    Enums: {
      app_role: 'admin' | 'player'
      fixture_status: 'scheduled' | 'live' | 'finished' | 'postponed'
      member_status: 'pending' | 'active' | 'blocked'
      pot_movement_kind: 'contribution' | 'payout' | 'adjustment'
      round_status: 'draft' | 'open' | 'settled' | 'void'
      settlement_kind: 'settled' | 'void'
    }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
