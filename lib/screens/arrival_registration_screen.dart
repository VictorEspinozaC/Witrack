import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import '../db/app_database.dart';
import '../models/models.dart';
import '../services/sync_service.dart';
import '../theme/app_theme.dart';
import '../utils/validators.dart';
import 'camera_screen.dart';

/// Pantalla de registro de llegada de camiones con OCR
class ArrivalRegistrationScreen extends StatefulWidget {
  final List<CameraDescription> cameras;
  const ArrivalRegistrationScreen({super.key, required this.cameras});

  @override
  State<ArrivalRegistrationScreen> createState() => _ArrivalRegistrationScreenState();
}

class _ArrivalRegistrationScreenState extends State<ArrivalRegistrationScreen> {
  final _db = AppDatabase.instance;
  final _formKey = GlobalKey<FormState>();
  
  // Campos del formulario
  String? _plate;
  final _manualPlateController = TextEditingController();
  final _nameController = TextEditingController();
  final _rutController = TextEditingController();
  final _phoneController = TextEditingController();
  
  // Tipo de camión y sucursal
  TruckType _truckType = TruckType.carga;
  TruckClassification _classification = TruckClassification.branchLoad;
  String? _selectedBranchId;
  String? _selectedTransportId;
  String? _selectedClientId;
  String? _selectedSupplierId;
  String? _selectedAddressId;
  
  DateTime? _birthDate;
  DateTime? _licenseExpiryDate;
  String _countryCode = '+56';
  
  List<Branch> _branches = [];
  List<TransportCompany> _transporters = [];
  List<Client> _clients = [];
  List<Supplier> _suppliers = [];
  List<DispatchAddress> _addresses = [];
  
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _manualPlateController.dispose();
    _nameController.dispose();
    _rutController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    final branches = await _db.getAllBranches();
    final transporters = await _db.getAllTransportCompanies();
    final clients = await _db.getAllClients();
    final suppliers = await _db.getAllSuppliers();

    setState(() {
      _branches = branches;
      _transporters = transporters;
      _clients = clients;
      _suppliers = suppliers;
      
      if (branches.isNotEmpty) {
        _selectedBranchId = branches.first.id;
      }
      _loading = false;
    });
  }

  Future<void> _loadAddresses(String clientId) async {
    final addresses = await _db.getDispatchAddresses(clientId);
    setState(() {
      _addresses = addresses;
      _selectedAddressId = addresses.isNotEmpty ? addresses.first.id : null;
    });
  }

  Future<void> _scanPlate() async {
    if (widget.cameras.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cámara no disponible (ej. en navegador). Usa "Ingresar patente manualmente".')),
      );
      return;
    }
    final plate = await Navigator.push<String?>(
      context,
      MaterialPageRoute(builder: (_) => CameraScreen(cameras: widget.cameras)),
    );
    if (plate != null && mounted) {
      setState(() {
        _plate = normalizePlate(plate);
        _manualPlateController.text = _plate!;
      });
    }
  }

  Future<void> _scanId() async {
    if (widget.cameras.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cámara no disponible. Ingresa RUT y nombre manualmente.')),
      );
      return;
    }
    final result = await Navigator.push<Map<String, String>?>(
      context,
      MaterialPageRoute(builder: (_) => CameraScreen(
        cameras: widget.cameras,
        mode: ScanMode.id,
      )),
    );

    if (result != null && mounted) {
      if (result['rut'] != null && result['rut']!.isNotEmpty) {
        _rutController.text = result['rut']!;
      }
      if (result['name'] != null && result['name']!.isNotEmpty) {
        _nameController.text = result['name']!;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Datos leídos correctamente ✅')),
      );
    }
  }

  Future<void> _registerArrival() async {
    if (!_formKey.currentState!.validate()) return;

    final manualPlate = _manualPlateController.text.trim();
    final plate = _plate ?? (manualPlate.isNotEmpty ? normalizePlate(manualPlate) : null);
    if (plate == null || plate.isEmpty) {
      _showError('Ingresa o escanea la patente del camión');
      return;
    }
    if (_branches.isEmpty) {
      _showError('No hay sucursales. Crea al menos una en el menú Administración.');
      return;
    }
    if (_selectedBranchId == null) {
      _showError('Selecciona una sucursal destino');
      return;
    }

    setState(() => _saving = true);

    try {
      final name = _nameController.text.trim();
      final rut = _rutController.text.trim();
      final phone = _phoneController.text.trim();

      // Buscar o crear camión
      var truck = await _db.getTruckByPlate(plate);
      if (truck == null) {
        final id = await _db.insertTruck(Truck(
          plate: plate,
          type: _truckType,
          classification: _classification,
          transportCompanyId: _selectedTransportId,
        ));
        truck = Truck(id: id, plate: plate, type: _truckType, classification: _classification, transportCompanyId: _selectedTransportId);
      } else {
        // Actualizar clasificación y transporte si es necesario
        await _db.updateTruck(Truck(
          id: truck.id,
          plate: truck.plate,
          type: _truckType,
          classification: _classification,
          transportCompanyId: _selectedTransportId ?? truck.transportCompanyId,
        ));
      }

      // Buscar o crear chofer
      Driver? driver = await _db.getDriverByRut(rut);
      String driverId;
      
      final formattedPhone = _phoneController.text.isNotEmpty 
          ? '$_countryCode ${_phoneController.text.trim()}' 
          : null;

      if (driver == null) {
        driverId = await _db.insertDriver(Driver(
          name: name,
          rut: rut,
          phone: formattedPhone,
          birthDate: _birthDate,
          licenseExpiryDate: _licenseExpiryDate,
          transportCompanyId: _selectedTransportId,
        ));
      } else {
        driverId = driver.id!;
        // Actualizar datos si cambiaron
        await _db.updateDriver(Driver(
          id: driverId,
          name: name,
          rut: rut,
          phone: formattedPhone ?? driver.phone,
          birthDate: _birthDate ?? driver.birthDate,
          licenseExpiryDate: _licenseExpiryDate ?? driver.licenseExpiryDate,
          transportCompanyId: _selectedTransportId ?? driver.transportCompanyId,
        ));
      }

      // Crear shipment
      await _db.insertShipment(Shipment(
        truckId: truck.id!,
        driverId: driverId,
        branchId: _selectedBranchId!,
        transportCompanyId: _selectedTransportId,
        clientId: _classification == TruckClassification.branchLoad ? _selectedClientId : null,
        supplierId: _classification == TruckClassification.supplierUnload ? _selectedSupplierId : null,
        dispatchAddressId: _classification == TruckClassification.branchLoad ? _selectedAddressId : null,
        status: ShipmentStatus.esperaIngreso,
        arrivalTime: DateTime.now(),
      ));

      // Limpiar formulario
      setState(() {
        _plate = null;
        _manualPlateController.clear();
        _nameController.clear();
        _rutController.clear();
        _phoneController.clear();
        _birthDate = null;
        _licenseExpiryDate = null;
        _truckType = TruckType.carga;
        _classification = TruckClassification.branchLoad;
        _selectedTransportId = null;
        _selectedClientId = null;
        _selectedSupplierId = null;
        _selectedAddressId = null;
      });

      _showSuccess('Llegada registrada correctamente');
      
      // Iniciar sincronización en background
      SyncService().syncAll();

    } catch (e) {
      _showError('Error al registrar: $e');
    } finally {
      setState(() => _saving = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppTheme.errorColor,
      ),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle, color: Colors.white),
            const SizedBox(width: 8),
            Text(message),
          ],
        ),
        backgroundColor: AppTheme.successColor,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Registrar Llegada')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Registrar Llegada'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_branches.isEmpty)
                Card(
                  color: Colors.orange.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Icon(Icons.warning_amber, color: Colors.orange.shade700),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'No hay sucursales. Crea al menos una en el menú (ícono Empresa) para poder registrar llegadas.',
                            style: TextStyle(color: Colors.orange.shade900),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              if (_branches.isEmpty) const SizedBox(height: 16),
              // Escaneo de patente
              _buildPlateSection(),
              const SizedBox(height: 24),

              // Tipo de camión
              _buildTruckTypeSection(),
              const SizedBox(height: 24),

              // Sucursal destino
              _buildBranchSection(),
              const SizedBox(height: 24),

              // Datos del chofer
              _buildDriverSection(),
              const SizedBox(height: 32),

              // Botón de registro
              _buildSubmitButton(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPlateSection() {
    final hasCamera = widget.cameras.isNotEmpty;
    final displayPlate = _plate ?? _manualPlateController.text.trim();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.qr_code_scanner, color: AppTheme.primaryColor),
                const SizedBox(width: 8),
                Text(
                  'Patente del Camión',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (hasCamera)
              if (_plate != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.primaryColor),
                  ),
                  child: Column(
                    children: [
                      Text(
                        _plate!,
                        style: const TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 4,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextButton.icon(
                        onPressed: _scanPlate,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Volver a escanear'),
                      ),
                    ],
                  ),
                )
              else
                SizedBox(
                  width: double.infinity,
                  height: 120,
                  child: OutlinedButton.icon(
                    onPressed: _scanPlate,
                    icon: const Icon(Icons.camera_alt, size: 32),
                    label: const Text(
                      'ESCANEAR PATENTE',
                      style: TextStyle(fontSize: 16),
                    ),
                    style: OutlinedButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
            const SizedBox(height: 12),
            Text(
              hasCamera ? 'O ingresa la patente manualmente' : 'Ingresa la patente (en web no hay cámara)',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey.shade600,
              ),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _manualPlateController,
              decoration: const InputDecoration(
                hintText: 'Ej: ABCD12 o AB-CD-12',
                prefixIcon: Icon(Icons.edit),
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.characters,
              onChanged: (value) {
                if (value.trim().isNotEmpty) setState(() => _plate = normalizePlate(value));
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTruckTypeSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.category, color: AppTheme.primaryColor),
                const SizedBox(width: 8),
                Text(
                  'Clasificación de Operación',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _TypeButton(
                    label: 'Carga Sucursal',
                    icon: Icons.store,
                    selected: _classification == TruckClassification.branchLoad,
                    onTap: () => setState(() {
                      _classification = TruckClassification.branchLoad;
                      _truckType = TruckType.carga;
                    }),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _TypeButton(
                    label: 'Descarga Proveedor',
                    icon: Icons.inventory_2,
                    selected: _classification == TruckClassification.supplierUnload,
                    onTap: () => setState(() {
                      _classification = TruckClassification.supplierUnload;
                      _truckType = TruckType.descarga;
                    }),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _TypeButton(
                    label: 'Maquila',
                    icon: Icons.settings_suggest,
                    selected: _classification == TruckClassification.maquila,
                    onTap: () => setState(() {
                      _classification = TruckClassification.maquila;
                      // En maquila puede ser tanto carga como descarga, 
                      // por defecto lo dejamos en carga pero el usuario podría elegir si agregamos el selector
                    }),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            
            // Selector de Empresa de Transporte (Común a todos)
            DropdownButtonFormField<String>(
              value: _selectedTransportId,
              decoration: const InputDecoration(
                labelText: 'Empresa de Transporte',
                prefixIcon: Icon(Icons.local_shipping),
              ),
              items: _transporters.map((t) => DropdownMenuItem(
                value: t.id,
                child: Text(t.name),
              )).toList(),
              onChanged: (v) => setState(() => _selectedTransportId = v),
              validator: (v) => v == null ? 'Selecciona la empresa de transporte' : null,
            ),
            const SizedBox(height: 16),

            // Campos específicos según clasificación
            if (_classification == TruckClassification.branchLoad) ...[
              DropdownButtonFormField<String>(
                value: _selectedClientId,
                decoration: const InputDecoration(
                  labelText: 'Cliente',
                  prefixIcon: Icon(Icons.business),
                ),
                items: _clients.map((c) => DropdownMenuItem(
                  value: c.id,
                  child: Text(c.name),
                )).toList(),
                onChanged: (v) {
                  setState(() => _selectedClientId = v);
                  if (v != null) _loadAddresses(v);
                },
                validator: (v) => v == null ? 'Selecciona un cliente' : null,
              ),
              const SizedBox(height: 16),
              if (_selectedClientId != null)
                DropdownButtonFormField<String>(
                  value: _selectedAddressId,
                  decoration: const InputDecoration(
                    labelText: 'Dirección de Despacho',
                    prefixIcon: Icon(Icons.location_on),
                  ),
                  items: _addresses.map((a) => DropdownMenuItem(
                    value: a.id,
                    child: Text(a.address),
                  )).toList(),
                  onChanged: (v) => setState(() => _selectedAddressId = v),
                  validator: (v) => v == null ? 'Selecciona una dirección' : null,
                ),
            ],

            if (_classification == TruckClassification.supplierUnload) 
              DropdownButtonFormField<String>(
                value: _selectedSupplierId,
                decoration: const InputDecoration(
                  labelText: 'Proveedor',
                  prefixIcon: Icon(Icons.inventory),
                ),
                items: _suppliers.map((s) => DropdownMenuItem(
                  value: s.id,
                  child: Text(s.name),
                )).toList(),
                onChanged: (v) => setState(() => _selectedSupplierId = v),
                validator: (v) => v == null ? 'Selecciona un proveedor' : null,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildBranchSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.store, color: AppTheme.primaryColor),
                const SizedBox(width: 8),
                Text(
                  'Sucursal Destino',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _selectedBranchId,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.business),
              ),
              items: _branches.map((branch) => DropdownMenuItem(
                value: branch.id,
                child: Text('${branch.name} (${branch.code})'),
              )).toList(),
              onChanged: (value) => setState(() => _selectedBranchId = value),
              validator: (value) => value == null ? 'Selecciona una sucursal' : null,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDriverSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.person, color: AppTheme.primaryColor),
                const SizedBox(width: 8),
                Text(
                  'Datos del Chofer',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: _scanId,
                  icon: const Icon(Icons.document_scanner),
                  label: const Text('Escanear Cédula'),
                  style: TextButton.styleFrom(
                    foregroundColor: AppTheme.primaryColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Nombre completo',
                prefixIcon: Icon(Icons.badge),
              ),
              textCapitalization: TextCapitalization.words,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Ingresa el nombre del chofer';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _rutController,
              decoration: const InputDecoration(
                labelText: 'RUT (ej: 12345678-5)',
                prefixIcon: Icon(Icons.assignment_ind),
              ),
              keyboardType: TextInputType.text,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Ingresa el RUT';
                }
                if (!isValidRut(value)) {
                  return 'RUT inválido';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  width: 100,
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade400),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _countryCode,
                      items: const [
                        DropdownMenuItem(value: '+56', child: Text('🇨🇱 +56')),
                        DropdownMenuItem(value: '+54', child: Text('🇦🇷 +54')),
                        DropdownMenuItem(value: '+55', child: Text('🇧🇷 +55')),
                        DropdownMenuItem(value: '+51', child: Text('🇵🇪 +51')),
                      ],
                      onChanged: (v) => setState(() => _countryCode = v!),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextFormField(
                    controller: _phoneController,
                    decoration: const InputDecoration(
                      labelText: 'Teléfono',
                      prefixIcon: Icon(Icons.phone),
                      hintText: '9 1234 5678',
                    ),
                    keyboardType: TextInputType.phone,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildDatePicker(
                    label: 'Fecha Nacimiento',
                    selectedDate: _birthDate,
                    onDateSelected: (d) => setState(() => _birthDate = d),
                    icon: Icons.cake,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildDatePicker(
                    label: 'Vence Licencia',
                    selectedDate: _licenseExpiryDate,
                    onDateSelected: (d) => setState(() => _licenseExpiryDate = d),
                    icon: Icons.credit_card,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDatePicker({
    required String label,
    required DateTime? selectedDate,
    required Function(DateTime) onDateSelected,
    required IconData icon,
  }) {
    final displayDate = selectedDate != null 
        ? '${selectedDate.day}/${selectedDate.month}/${selectedDate.year}'
        : 'Seleccionar';

    return InkWell(
      onTap: () async {
        final date = await showDatePicker(
          context: context,
          initialDate: selectedDate ?? DateTime.now(),
          firstDate: DateTime(1950),
          lastDate: DateTime(2100),
        );
        if (date != null) onDateSelected(date);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade400),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(icon, size: 16, color: AppTheme.primaryColor),
                const SizedBox(width: 8),
                Text(displayDate, style: const TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton.icon(
        onPressed: _saving ? null : _registerArrival,
        icon: _saving
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : const Icon(Icons.check),
        label: Text(
          _saving ? 'REGISTRANDO...' : 'REGISTRAR LLEGADA',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}

class _TypeButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _TypeButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected
              ? AppTheme.primaryColor.withOpacity(0.1)
              : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? AppTheme.primaryColor : Colors.grey.shade300,
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              size: 32,
              color: selected ? AppTheme.primaryColor : Colors.grey,
            ),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                color: selected ? AppTheme.primaryColor : Colors.grey.shade700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
