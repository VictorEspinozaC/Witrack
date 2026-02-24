import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi_web/sqflite_ffi_web.dart';
import 'init_database_factory.dart';
import 'theme/app_theme.dart';
import 'services/auth_service.dart';
import 'services/sync_service.dart';
import 'services/theme_provider.dart';
import 'screens/login_screen.dart';
import 'screens/availability_screen.dart';
import 'screens/arrival_registration_screen.dart';
import 'screens/records_screen.dart';
import 'screens/schedule_list_screen.dart';
import 'screens/incidents_screen.dart';
import 'screens/branch_management_screen.dart';
import 'screens/admin_panel_screen.dart';

import 'package:supabase_flutter/supabase_flutter.dart';
import 'config/supabase_config.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Necesario para SQLite: web usa WASM/IndexedDB; escritorio usa FFI.
  if (kIsWeb) {
    databaseFactory = databaseFactoryFfiWebNoWebWorker;
  } else {
    initDatabaseFactoryDesktop();
  }

  await Supabase.initialize(
    url: SupabaseConfig.url,
    anonKey: SupabaseConfig.anonKey,
  );

  List<CameraDescription> cameras = [];
  try {
    cameras = await availableCameras();
  } catch (_) {
    // En web o sin cámara la lista puede fallar o estar vacía
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: TruckManagementApp(cameras: cameras),
    ),
  );
}

class TruckManagementApp extends StatelessWidget {
  final List<CameraDescription> cameras;
  const TruckManagementApp({super.key, required this.cameras});

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Gestión de Camiones',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeProvider.themeMode,
      home: AuthWrapper(cameras: cameras),
    );
  }
}

class AuthWrapper extends StatelessWidget {
  final List<CameraDescription> cameras;
  const AuthWrapper({super.key, required this.cameras});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    
    if (auth.isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    
    if (!auth.isAuthenticated) {
      return const LoginScreen();
    }
    
    // Iniciar sincronización automática cuando el usuario se autentica
    WidgetsBinding.instance.addPostFrameCallback((_) {
      SyncService().startAutoSync(intervalSeconds: 300);
    });
    
    return MainDashboard(cameras: cameras);
  }
}



/// Dashboard principal con navegación inferior
class MainDashboard extends StatefulWidget {
  final List<CameraDescription> cameras;
  const MainDashboard({super.key, required this.cameras});

  @override
  State<MainDashboard> createState() => _MainDashboardState();
}

class _MainDashboardState extends State<MainDashboard> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().currentUser;
    final isCliente = user?.isCliente ?? false;

    // Screens and destinations for everyone
    final allChildren = [
      const AvailabilityScreen(),
      if (!isCliente) const ScheduleListScreen(),
      if (!isCliente) ArrivalRegistrationScreen(cameras: widget.cameras),
      const IncidentsScreen(),
      if (!isCliente) const RecordsScreen(),
    ];

    final allDestinations = [
      const NavigationDestination(
        icon: Icon(Icons.dashboard_outlined),
        selectedIcon: Icon(Icons.dashboard),
        label: 'Disponibilidad',
      ),
      if (!isCliente) const NavigationDestination(
        icon: Icon(Icons.calendar_month_outlined),
        selectedIcon: Icon(Icons.calendar_month),
        label: 'Programación',
      ),
      if (!isCliente) const NavigationDestination(
        icon: Icon(Icons.add_circle_outline),
        selectedIcon: Icon(Icons.add_circle),
        label: 'Registrar',
      ),
      const NavigationDestination(
        icon: Icon(Icons.warning_outlined),
        selectedIcon: Icon(Icons.warning),
        label: 'Incidencias',
      ),
      if (!isCliente) const NavigationDestination(
        icon: Icon(Icons.history_outlined),
        selectedIcon: Icon(Icons.history),
        label: 'Historial',
      ),
    ];

    // Ajustar índice si el actual queda fuera de rango (ej: si se deslogeó un admin y entró un cliente)
    if (_currentIndex >= allChildren.length) {
      _currentIndex = 0;
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Gestión de Camiones'),
        actions: [
          IconButton(
            icon: const Icon(Icons.cloud_sync),
            tooltip: 'Sincronizar datos',
            onPressed: () async {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Sincronizando con la nube... ☁️')),
              );
              await SyncService().syncAll();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Sincronización finalizada ✅')),
              );
            },
          ),
          IconButton(
            icon: Icon(
              context.watch<ThemeProvider>().isDarkMode 
                  ? Icons.light_mode 
                  : Icons.dark_mode
            ),
            tooltip: 'Cambiar tema',
            onPressed: () {
              context.read<ThemeProvider>().toggleTheme();
            },
          ),
          if (user?.isAdmin ?? false)
            IconButton(
              icon: const Icon(Icons.admin_panel_settings),
              tooltip: 'Administración',
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AdminPanelScreen()),
                );
              },
            ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Cerrar sesión',
            onPressed: () {
              // Detener sincronización antes de cerrar sesión
              SyncService().stopAutoSync();
              context.read<AuthService>().logout();
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: allChildren,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: allDestinations,
      ),
    );
  }
}
