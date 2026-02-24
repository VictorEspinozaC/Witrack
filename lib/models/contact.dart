/// Tipo de contacto
enum ContactType { transporter, client, supplier }

/// Representa un contacto para una entidad
class Contact {
  final String? id;
  final String ownerId; // ID de la empresa/cliente/proveedor
  final ContactType type;
  final String name;
  final String phone;
  final String email;

  Contact({
    this.id,
    required this.ownerId,
    required this.type,
    required this.name,
    required this.phone,
    required this.email,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'owner_id': ownerId,
    'type': type.name,
    'name': name,
    'phone': phone,
    'email': email,
  };

  factory Contact.fromMap(Map<String, dynamic> m) => Contact(
    id: m['id']?.toString(),
    ownerId: m['owner_id']?.toString() ?? '',
    type: ContactType.values.byName(m['type'] as String),
    name: m['name'] as String,
    phone: m['phone'] as String,
    email: m['email'] as String,
  );
}
