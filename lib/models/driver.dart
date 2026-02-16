/// Representa un chofer
class Driver {
  final int? id;
  final String name;
  final String rut;
  final String? phone;

  Driver({
    this.id,
    required this.name,
    required this.rut,
    this.phone,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'rut': rut,
    'phone': phone,
  };

  factory Driver.fromMap(Map<String, dynamic> m) => Driver(
    id: m['id'] as int?,
    name: m['name'] as String,
    rut: m['rut'] as String,
    phone: m['phone'] as String?,
  );

  @override
  String toString() => 'Driver($rut: $name)';
}
