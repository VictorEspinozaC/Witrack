import 'package:flutter/material.dart';
import '../db/app_database.dart';
import '../models/models.dart';

class TransportManagementScreen extends StatefulWidget {
  const TransportManagementScreen({super.key});

  @override
  State<TransportManagementScreen> createState() => _TransportManagementScreenState();
}

class _TransportManagementScreenState extends State<TransportManagementScreen> {
  final _db = AppDatabase.instance;
  List<TransportCompany> _companies = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final companies = await _db.getAllTransportCompanies();
    setState(() {
      _companies = companies;
      _isLoading = false;
    });
  }

  Future<void> _showForm([TransportCompany? company]) async {
    final nameController = TextEditingController(text: company?.name);
    final rutController = TextEditingController(text: company?.rut);
    final addressController = TextEditingController(text: company?.billingAddress);
    final zipController = TextEditingController(text: company?.zipCode);
    final isEditing = company != null;

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isEditing ? 'Editar Transporte' : 'Nuevo Transporte'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Razón Social'),
              ),
              TextField(
                controller: rutController,
                decoration: const InputDecoration(labelText: 'RUT'),
              ),
              TextField(
                controller: addressController,
                decoration: const InputDecoration(labelText: 'Dirección Facturación'),
              ),
              TextField(
                controller: zipController,
                decoration: const InputDecoration(labelText: 'Código Postal'),
                keyboardType: TextInputType.number,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () async {
              if (nameController.text.isEmpty || rutController.text.isEmpty || zipController.text.isEmpty) return;
              
              final newCompany = TransportCompany(
                id: company?.id,
                name: nameController.text.trim(),
                rut: rutController.text.trim(),
                billingAddress: addressController.text.trim(),
                zipCode: zipController.text.trim(),
              );

              if (isEditing) {
                await _db.updateTransportCompany(newCompany);
              } else {
                await _db.insertTransportCompany(newCompany);
              }
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
      appBar: AppBar(title: const Text('Empresas de Transporte')),
      body: _isLoading 
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _companies.length,
              itemBuilder: (context, index) {
                final company = _companies[index];
                return ListTile(
                  title: Text(company.name),
                  subtitle: Text('RUT: ${company.rut}'),
                  trailing: IconButton(
                    icon: const Icon(Icons.edit),
                    onPressed: () => _showForm(company),
                  ),
                  onTap: () {
                    // Navigate to contact management for this company
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
