@@ .. @@
 import React from 'react';
+import { useEffect } from 'react';
+import { useNavigate } from 'react-router-dom';
+import { UserService } from '../services/userService';
 import AdminDashboard from '../components/AdminDashboard';

 const AdminDashboardPage = () => {
+  const navigate = useNavigate();
+
+  useEffect(() => {
+    const checkAuth = async () => {
+      const isAuth = UserService.isAuthenticated();
+      if (!isAuth) {
+        // If not authenticated, redirect to home
+        navigate('/', { replace: true });
+        return;
+      }
+      
+      const user = await UserService.getCurrentUser();
+      if (!user || user.role !== 'administrator') {
+        // If not admin, redirect to home
+        navigate('/', { replace: true });
+      }
+    };
+    
+    checkAuth();
+  }, [navigate]);
+
   return <AdminDashboard />;
 };

 export default AdminDashboardPage;