import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw, Database } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const SupabaseConnectionTest = () => {
  const [status, setStatus] = useState<'testing' | 'connected' | 'error'>('testing');
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    setStatus('testing');
    setError(null);
    
    try {
      // Test the connection by fetching the list of tables
      const { data, error } = await supabase
        .from('profiles')
        .select('count(*)', { count: 'exact', head: true });
      
      if (error) throw error;
      
      // Get list of tables
      const { data: tableData, error: tableError } = await supabase
        .rpc('get_tables');
        
      if (tableError) {
        console.warn('Could not fetch tables list:', tableError);
      } else {
        setTables(tableData || []);
      }
      
      setStatus('connected');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200 mb-6">
      <div className="flex items-center mb-4">
        {status === 'testing' && <RefreshCw className="h-6 w-6 text-blue-500 animate-spin mr-3" />}
        {status === 'connected' && <CheckCircle className="h-6 w-6 text-green-500 mr-3" />}
        {status === 'error' && <XCircle className="h-6 w-6 text-red-500 mr-3" />}
        
        <h3 className="font-poppins text-lg font-semibold text-neutral-900">
          Supabase Connection
        </h3>
      </div>
      
      {status === 'connected' && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center mb-3">
            <Database className="h-5 w-5 text-green-600 mr-2" />
            <h4 className="font-poppins font-semibold text-green-800">✅ Connected to Supabase!</h4>
          </div>
          
          <p className="font-lora text-sm text-green-700 mb-3">
            Your Supabase connection is working correctly. The following tables are available:
          </p>
          
          <div className="bg-white rounded-lg p-3 border border-green-200">
            <ul className="font-mono text-xs text-green-700 space-y-1">
              {tables.map((table, index) => (
                <li key={index}>• {table}</li>
              ))}
              {tables.length === 0 && <li>• No tables found or permissions issue</li>}
            </ul>
          </div>
        </div>
      )}
      
      {status === 'error' && (
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <h4 className="font-poppins font-semibold text-red-800 mb-2">
            ❌ Connection Failed
          </h4>
          <p className="font-lora text-sm text-red-700 mb-3">
            Error: {error || 'Unknown error connecting to Supabase'}
          </p>
          <p className="font-lora text-sm text-red-700 mb-3">
            Please check your Supabase connection and environment variables.
          </p>
          <button
            onClick={testConnection}
            className="font-poppins bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      )}
      
      {status === 'testing' && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h4 className="font-poppins font-semibold text-blue-800 mb-2">
            Testing Connection...
          </h4>
          <p className="font-lora text-sm text-blue-700">
            Connecting to your Supabase database...
          </p>
        </div>
      )}
    </div>
  );
};

export default SupabaseConnectionTest;