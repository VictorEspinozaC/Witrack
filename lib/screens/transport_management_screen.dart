import 'package:flutter/material.dart';
import '../db/app_database.dart';
import '../models/models.dart';
import '../utils/address_form_widget.dart';

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
    final isEditing = company != null;

    AddressData addressData = AddressData(
      region: company?.region ?? '',
      comuna: company?.comuna ?? '',
      calle: company?.calle ?? '',
      numeracion: company?.numeracion ?? '',
      depto: company?.depto ?? '',
    );

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isEditing ? 'Editar Transporte' : 'Nuevo Transporte'),
        content: SizedBox(
          width: 450,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'Razón Social'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: rutController,
                  decoration: const InputDecoration(labelText: 'RUT'),
                ),
                const SizedBox(height: 16),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Dirección de Facturación',
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
              if (nameController.text.isEmpty || rutController.text.isEmpty) return;

              final newCompany = TransportCompany(
                id: company?.id,
                name: nameController.text.trim(),
                rut: rutController.text.trim(),
                region: addressData.region,
                comuna: addressData.comuna,
                calle: addressData.calle,
                numeracion: addressData.numeracion,
                depto: addressData.depto,
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
                  subtitle: Text('RUT: ${company.rut}\n${company.direccionFormateada}'),
                  isThreeLine: true,
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
