/// Representa un chofer
class Driver {
  final String? id;
  final String name;
  final String rut;
  final String? phone;
  final DateTime? birthDate;
  final DateTime? licenseExpiryDate;
  final String? transportCompanyId;

  Driver({
    this.id,
    required this.name,
    required this.rut,
    this.phone,
    this.birthDate,
    this.licenseExpiryDate,
    this.transportCompanyId,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'rut': rut,
    'phone': phone,
    'birth_date': birthDate?.toIso8601String(),
    'license_expiry_date': licenseExpiryDate?.toIso8601String(),
    'transport_company_id': transportCompanyId,
  };

  factory Driver.fromMap(Map<String, dynamic> m) => Driver(
    id: m['id']?.toString(),
    name: m['name'] as String,
    rut: m['rut'] as String,
    phone: m['phone'] as String?,
    birthDate: m['birth_date'] != null ? DateTime.parse(m['birth_date'] as String) : null,
    licenseExpiryDate: m['license_expiry_date'] != null ? DateTime.parse(m['license_expiry_date'] as String) : null,
    transportCompanyId: m['transport_company_id']?.toString(),
  );

  @override
  String toString() => 'Driver($rut: $name)';
}
