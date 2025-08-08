import { supabase } from './supabaseClient';

export interface AppSetting {
  id: string;
  setting_name: string;
  setting_value: any;
  created_at: string;
  updated_at: string;
}

export class AppSettingsService {
  // Get a specific setting by name
  static async getSetting(settingName: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_name', settingName)
        .single();

      if (error) {
        console.warn(`Setting '${settingName}' not found:`, error);
        return null;
      }

      return data?.setting_value || null;
    } catch (error) {
      console.error('Error fetching app setting:', error);
      return null;
    }
  }

  // Update a setting (admin only)
  static async updateSetting(settingName: string, settingValue: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_name: settingName,
          setting_value: settingValue,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      console.log(`✅ Setting '${settingName}' updated successfully`);
      return true;
    } catch (error) {
      console.error('Error updating app setting:', error);
      return false;
    }
  }

  // Get all settings (admin only)
  static async getAllSettings(): Promise<AppSetting[]> {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .order('setting_name');

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching all settings:', error);
      return [];
    }
  }

  // Initialize default settings if they don't exist
  static async initializeDefaultSettings(): Promise<void> {
    try {
      const defaultSettings = [
        {
          setting_name: 'enable_vision_moderation',
          setting_value: {
            enabled: false,
            description: 'Enable Google Cloud Vision SafeSearch for image moderation'
          }
        }
      ];

      for (const setting of defaultSettings) {
        const { error } = await supabase
          .from('app_settings')
          .upsert(setting, {
            onConflict: 'setting_name',
            ignoreDuplicates: true
          });

        if (error) {
          console.error(`Error initializing setting '${setting.setting_name}':`, error);
        }
      }

      console.log('✅ Default app settings initialized');
    } catch (error) {
      console.error('Error initializing default settings:', error);
    }
  }
}