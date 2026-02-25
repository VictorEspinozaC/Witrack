import 'package:flutter/material.dart';
import '../db/app_database.dart';
import '../models/models.dart';
import '../utils/address_form_widget.dart';

class ClientManagementScreen extends StatefulWidget {
  const ClientManagementScreen({super.key});

  @override
  State<ClientManagementScreen> createState() => _ClientManagementScreenState();
}

class _ClientManagementScreenState extends State<ClientManagementScreen> {
  final _db = AppDatabase.instance;
  List<Client> _clients = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final clients = await _db.getAllClients();
    setState(() {
      _clients = clients;
      _isLoading = false;
    });
  }

  Future<void> _showForm([Client? client]) async {
    final nameController = TextEditingController(text: client?.name);
    final rutController = TextEditingController(text: client?.rut);
    final isEditing = client != null;

    AddressData addressData = AddressData(
      region: client?.region ?? '',
      comuna: client?.comuna ?? '',
      calle: client?.calle ?? '',
      numeracion: client?.numeracion ?? '',
      depto: client?.depto ?? '',
    );

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isEditing ? 'Editar Cliente' : 'Nuevo Cliente'),
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

              final newClient = Client(
                id: client?.id,
                name: nameController.text.trim(),
                rut: rutController.text.trim(),
                region: addressData.region,
                comuna: addressData.comuna,
                calle: addressData.calle,
                numeracion: addressData.numeracion,
                depto: addressData.depto,
              );

              if (isEditing) {
                await _db.updateClient(newClient);
              } else {
                await _db.insertClient(newClient);
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
      appBar: AppBar(title: const Text('Gestión de Clientes')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _clients.length,
              itemBuilder: (context, index) {
                final client = _clients[index];
                return ListTile(
                  title: Text(client.name),
                  subtitle: Text('RUT: ${client.rut}\n${client.direccionFormateada}'),
                  isThreeLine: true,
                  trailing: IconButton(
                    icon: const Icon(Icons.edit),
                    onPressed: () => _showForm(client),
                  ),
                  onTap: () {
                    // Navigate to dispatch addresses or contacts
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
