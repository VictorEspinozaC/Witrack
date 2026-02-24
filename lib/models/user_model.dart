enum UserRole {
  admin,
  planta,
  sucursal,
  chofer,
  cliente,
}

class User {
  final String id;
  final String? supabaseId; // UUID de Supabase Auth
  final String email;
  final String name;
  final UserRole role;
  final String? branchId; // ID de sucursal si aplica
  final String? clientId; // ID de cliente si aplica

  User({
    required this.id,
    this.supabaseId,
    required this.email,
    required this.name,
    required this.role,
    this.branchId,
    this.clientId,
  });

  bool get isPlanta => role == UserRole.planta || isAdmin;
  bool get isSucursal => role == UserRole.sucursal;
  bool get isAdmin => role == UserRole.admin || email == 'victor.espinoza@outlook.com';
  bool get isCliente => role == UserRole.cliente;

  /// Crear User desde perfil de Supabase
  factory User.fromSupabase(Map<String, dynamic> profile, String authId) {
    return User(
      id: profile['id']?.toString() ?? authId,
      supabaseId: authId,
      email: profile['email'] ?? '',
      name: profile['full_name'] ?? profile['email'] ?? '',
      role: _parseRole(profile['role']),
      branchId: profile['branch_id']?.toString(),
      clientId: profile['client_id']?.toString(),
    );
  }

  static UserRole _parseRole(String? roleStr) {
    switch (roleStr) {
      case 'admin':
        return UserRole.admin;
      case 'planta':
        return UserRole.planta;
      case 'sucursal':
        return UserRole.sucursal;
      case 'chofer':
        return UserRole.chofer;
      case 'cliente':
        return UserRole.cliente;
      default:
        return UserRole.planta; // Default para nuevos usuarios
    }
  }

  Map<String, dynamic> toMap() {
    return {
      'id': supabaseId,
      'email': email,
      'full_name': name,
      'role': role.name,
      'branch_id': branchId,
      'client_id': clientId,
    };
  }
}
