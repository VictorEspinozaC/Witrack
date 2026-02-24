import 'package:flutter/material.dart';
import '../db/app_database.dart';
import '../models/models.dart';

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
    final addressController = TextEditingController(text: client?.billingAddress);
    final zipController = TextEditingController(text: client?.zipCode);
    final isEditing = client != null;

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isEditing ? 'Editar Cliente' : 'Nuevo Cliente'),
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
              
              final newClient = Client(
                id: client?.id,
                name: nameController.text.trim(),
                rut: rutController.text.trim(),
                billingAddress: addressController.text.trim(),
                zipCode: zipController.text.trim(),
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
                  subtitle: Text('RUT: ${client.rut}'),
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
