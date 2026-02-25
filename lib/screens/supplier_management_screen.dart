import 'package:flutter/material.dart';
import '../db/app_database.dart';
import '../models/models.dart';
import '../utils/address_form_widget.dart';

class SupplierManagementScreen extends StatefulWidget {
  const SupplierManagementScreen({super.key});

  @override
  State<SupplierManagementScreen> createState() => _SupplierManagementScreenState();
}

class _SupplierManagementScreenState extends State<SupplierManagementScreen> {
  final _db = AppDatabase.instance;
  List<Supplier> _suppliers = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final suppliers = await _db.getAllSuppliers();
    setState(() {
      _suppliers = suppliers;
      _isLoading = false;
    });
  }

  Future<void> _showForm([Supplier? supplier]) async {
    final nameController = TextEditingController(text: supplier?.name);
    final isEditing = supplier != null;

    AddressData addressData = AddressData(
      region: supplier?.region ?? '',
      comuna: supplier?.comuna ?? '',
      calle: supplier?.calle ?? '',
      numeracion: supplier?.numeracion ?? '',
      depto: supplier?.depto ?? '',
    );

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'),
        content: SizedBox(
          width: 450,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'Nombre / Razón Social'),
                ),
                const SizedBox(height: 16),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Dirección',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
                const SizedBox(height: 8),
                AddressFormWidget(
                  initialData: addressData,
                  onChanged: (data) => addressData = data,
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () async {
              if (nameController.text.isEmpty) return;

              final newSupplier = Supplier(
                id: supplier?.id,
                name: nameController.text.trim(),
                region: addressData.region,
                comuna: addressData.comuna,
                calle: addressData.calle,
                numeracion: addressData.numeracion,
                depto: addressData.depto,
              );

              await _db.insertSupplier(newSupplier);
              Navigator.pop(context, true);
            },
            child: Text(isEditing ? 'Guardar' : 'Crear'),
          ),
        ],
      ),
    );

    if (result == true) _loadData();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Gestión de Proveedores')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _suppliers.length,
              itemBuilder: (context, index) {
                final supplier = _suppliers[index];
                return ListTile(
                  title: Text(supplier.name),
                  subtitle: Text(supplier.direccionFormateada),
                  trailing: IconButton(
                    icon: const Icon(Icons.edit),
                    onPressed: () => _showForm(supplier),
                  ),
                  onTap: () {
                    // Navigate to contacts
                  },
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showForm(),
        child: const Icon(Icons.add),
      ),
    );
  }
}
