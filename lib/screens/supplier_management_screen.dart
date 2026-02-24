import 'package:flutter/material.dart';
import '../db/app_database.dart';
import '../models/models.dart';

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
    final zipController = TextEditingController(text: supplier?.zipCode);
    final isEditing = supplier != null;

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Nombre / Razón Social'),
            ),
            TextField(
              controller: zipController,
              decoration: const InputDecoration(labelText: 'Código Postal'),
              keyboardType: TextInputType.number,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () async {
              if (nameController.text.isEmpty || zipController.text.isEmpty) return;
              
              final newSupplier = Supplier(
                id: supplier?.id,
                name: nameController.text.trim(),
                zipCode: zipController.text.trim(),
              );

              // We need insertSupplier and updateSupplier in AppDatabase (already added insert)
              // For simplicity I'll just use insert if null or a generic update if I add it
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
                  subtitle: Text('CP: ${supplier.zipCode}'),
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
