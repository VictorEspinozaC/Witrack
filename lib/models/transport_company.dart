/// Representa una empresa de transporte
class TransportCompany {
  final String? id;
  final String name; // Razón Social
  final String rut;
  final String billingAddress;
  final String zipCode;

  TransportCompany({
    this.id,
    required this.name,
    required this.rut,
    required this.billingAddress,
    required this.zipCode,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'rut': rut,
    'billing_address': billingAddress,
    'zip_code': zipCode,
  };

  factory TransportCompany.fromMap(Map<String, dynamic> m) => TransportCompany(
    id: m['id']?.toString(),
    name: m['name'] as String,
    rut: m['rut'] as String,
    billingAddress: m['billing_address'] as String,
    zipCode: m['zip_code'] as String,
  );
}
