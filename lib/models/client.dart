/// Representa un cliente
class Client {
  final String? id;
  final String name; // Razón Social
  final String rut;
  final String billingAddress;
  final String zipCode;

  Client({
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

  factory Client.fromMap(Map<String, dynamic> m) => Client(
    id: m['id']?.toString(),
    name: m['name'] as String,
    rut: m['rut'] as String,
    billingAddress: m['billing_address'] as String,
    zipCode: m['zip_code'] as String,
  );
}

/// Representa una dirección de despacho de un cliente
class DispatchAddress {
  final String? id;
  final String clientId;
  final String address;
  final String zipCode;

  DispatchAddress({
    this.id,
    required this.clientId,
    required this.address,
    required this.zipCode,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'client_id': clientId,
    'address': address,
    'zip_code': zipCode,
  };

  factory DispatchAddress.fromMap(Map<String, dynamic> m) => DispatchAddress(
    id: m['id']?.toString(),
    clientId: m['client_id']?.toString() ?? '',
    address: m['address'] as String,
    zipCode: m['zip_code'] as String,
  );
}
