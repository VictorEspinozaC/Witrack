/// Representa un proveedor
class Supplier {
  final String? id;
  final String name;
  final String zipCode;

  Supplier({
    this.id,
    required this.name,
    required this.zipCode,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'zip_code': zipCode,
  };

  factory Supplier.fromMap(Map<String, dynamic> m) => Supplier(
    id: m['id']?.toString(),
    name: m['name'] as String,
    zipCode: m['zip_code'] as String,
  );
}
