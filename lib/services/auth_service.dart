import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/models.dart' as models;

class AuthService extends ChangeNotifier {
  final _supabase = Supabase.instance.client;
  
  models.User? _currentUser;
  bool _isLoading = true;
  String? _errorMessage;

  models.User? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _currentUser != null;
  String? get errorMessage => _errorMessage;

  AuthService() {
    _initAuth();
  }

  /// Inicializa el estado de autenticación
  Future<void> _initAuth() async {
    try {
      // Escuchar cambios de autenticación
      _supabase.auth.onAuthStateChange.listen((data) {
        final session = data.session;
        if (session != null) {
          _loadUserProfile(session.user.id);
        } else {
          _currentUser = null;
          _isLoading = false;
          notifyListeners();
        }
      });

      // Verificar sesión existente
      final session = _supabase.auth.currentSession;
      if (session != null) {
        await _loadUserProfile(session.user.id);
      } else {
        _isLoading = false;
        notifyListeners();
      }
    } catch (e) {
      _isLoading = false;
      _errorMessage = 'Error inicializando autenticación';
      notifyListeners();
    }
  }

  /// Carga el perfil del usuario desde la tabla users
  Future<void> _loadUserProfile(String supabaseId) async {
    try {
      final response = await _supabase
          .from('users')
          .select()
          .eq('id', supabaseId)
          .maybeSingle();

      if (response != null) {
        _currentUser = models.User.fromSupabase(response, supabaseId);
      } else {
        // Usuario autenticado pero sin perfil - crear perfil básico
        final authUser = _supabase.auth.currentUser;
        if (authUser != null) {
          await _createUserProfile(authUser);
        }
      }
    } catch (e) {
      print('Error cargando perfil: $e');
      // Si no existe la tabla o hay error, crear usuario desde auth
      final authUser = _supabase.auth.currentUser;
      if (authUser != null) {
        _currentUser = models.User(
          id: supabaseId,
          supabaseId: supabaseId,
          email: authUser.email ?? '',
          name: authUser.userMetadata?['full_name'] ?? authUser.email ?? '',
          role: models.UserRole.planta,
        );
      }
    }
    _isLoading = false;
    notifyListeners();
  }

  /// Crea el perfil del usuario en la tabla users
  Future<void> _createUserProfile(User authUser) async {
    try {
      final profile = {
        'id': authUser.id,
        'email': authUser.email,
        'full_name': authUser.userMetadata?['full_name'] ?? authUser.email,
        'role': 'planta', // Rol por defecto
      };
      
      await _supabase.from('users').insert(profile);
      
      _currentUser = models.User.fromSupabase(profile, authUser.id);
    } catch (e) {
      print('Error creando perfil: $e');
      // Continuar sin perfil en BD, usar datos básicos
      _currentUser = models.User(
        id: authUser.id,
        supabaseId: authUser.id,
        email: authUser.email ?? '',
        name: authUser.userMetadata?['full_name'] ?? authUser.email ?? '',
        role: models.UserRole.planta,
      );
    }
  }

  /// Login con email y contraseña
  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _supabase.auth.signInWithPassword(
        email: email.trim(),
        password: password,
      );

      if (response.user != null) {
        await _loadUserProfile(response.user!.id);
        return true;
      }
      
      _errorMessage = 'Error de autenticación';
      _isLoading = false;
      notifyListeners();
      return false;
      
    } on AuthException catch (e) {
      _isLoading = false;
      _errorMessage = _translateAuthError(e.message);
      notifyListeners();
      return false;
    } catch (e) {
      _isLoading = false;
      _errorMessage = 'Error de conexión. Verifica tu internet.';
      notifyListeners();
      return false;
    }
  }

  /// Registro de nuevo usuario
  Future<bool> signUp(String email, String password, String fullName) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _supabase.auth.signUp(
        email: email.trim(),
        password: password,
        data: {'full_name': fullName.trim()},
      );

      if (response.user != null) {
        // Crear perfil en tabla users
        await _createUserProfile(response.user!);
        _isLoading = false;
        notifyListeners();
        return true;
      }
      
      _errorMessage = 'Error al registrar usuario';
      _isLoading = false;
      notifyListeners();
      return false;
      
    } on AuthException catch (e) {
      _isLoading = false;
      _errorMessage = _translateAuthError(e.message);
      notifyListeners();
      return false;
    } catch (e) {
      _isLoading = false;
      _errorMessage = 'Error de conexión. Verifica tu internet.';
      notifyListeners();
      return false;
    }
  }

  /// Recuperar contraseña
  Future<bool> resetPassword(String email) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _supabase.auth.resetPasswordForEmail(email.trim());
      _isLoading = false;
      notifyListeners();
      return true;
    } on AuthException catch (e) {
      _isLoading = false;
      _errorMessage = _translateAuthError(e.message);
      notifyListeners();
      return false;
    } catch (e) {
      _isLoading = false;
      _errorMessage = 'Error al enviar email de recuperación';
      notifyListeners();
      return false;
    }
  }

  /// Cerrar sesión
  Future<void> logout() async {
    await _supabase.auth.signOut();
    _currentUser = null;
    notifyListeners();
  }

  /// Traduce errores de Supabase Auth a español
  String _translateAuthError(String message) {
    if (message.contains('Invalid login credentials')) {
      return 'Email o contraseña incorrectos';
    }
    if (message.contains('Email not confirmed')) {
      return 'Debes confirmar tu email antes de iniciar sesión';
    }
    if (message.contains('User already registered')) {
      return 'Este email ya está registrado';
    }
    if (message.contains('Password should be at least')) {
      return 'La contraseña debe tener al menos 6 caracteres';
    }
    if (message.contains('Invalid email')) {
      return 'El email no es válido';
    }
    return message;
  }
}
