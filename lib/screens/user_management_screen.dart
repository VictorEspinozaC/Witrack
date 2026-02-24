import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/auth_service.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as supabase;
import '../db/app_database.dart';

class UserManagementScreen extends StatefulWidget {
  const UserManagementScreen({super.key});

  @override
  State<UserManagementScreen> createState() => _UserManagementScreenState();
}

class _UserManagementScreenState extends State<UserManagementScreen> {
  final _db = AppDatabase.instance;
  List<Map<String, dynamic>> _users = [];
  List<Client> _clients = [];
  List<Branch> _branches = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    
    // In a real app, we would query a 'users' table in Supabase via a service
    // For now we query the 'users' table we've been using in sync
    final client = supabase.Supabase.instance.client;
    try {
      final response = await client.from('users').select();
      final clients = await _db.getAllClients();
      final branches = await _db.getAllBranches();
      
      setState(() {
        _users = List<Map<String, dynamic>>.from(response);
        _clients = clients;
        _branches = branches;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error cargando usuarios: $e')),
      );
    }
  }

  Future<void> _showEditDialog(Map<String, dynamic> user) async {
    String selectedRole = user['role'] ?? 'planta';
    String? selectedBranchId = user['branch_id']?.toString();
    String? selectedClientId = user['client_id']?.toString();

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text('Editar Usuario: ${user['email']}'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: selectedRole,
                  decoration: const InputDecoration(labelText: 'Rol'),
                  items: ['admin', 'planta', 'sucursal', 'chofer', 'cliente'].map((r) => DropdownMenuItem(
                    value: r,
                    child: Text(r.toUpperCase()),
                  )).toList(),
                  onChanged: (v) => setState(() => selectedRole = v!),
                ),
                const SizedBox(height: 16),
                if (selectedRole == 'sucursal')
                  DropdownButtonFormField<String>(
                    value: selectedBranchId,
                    decoration: const InputDecoration(labelText: 'Sucursal'),
                    items: _branches.map((b) => DropdownMenuItem(
                      value: b.id,
                      child: Text(b.name),
                    )).toList(),
                    onChanged: (v) => setState(() => selectedBranchId = v),
                  ),
                if (selectedRole == 'cliente')
                  DropdownButtonFormField<String>(
                    value: selectedClientId,
                    decoration: const InputDecoration(labelText: 'Asociar a Cliente'),
                    items: _clients.map((c) => DropdownMenuItem(
                      value: c.id,
                      child: Text(c.name),
                    )).toList(),
                    onChanged: (v) => setState(() => selectedClientId = v),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: () async {
                final client = supabase.Supabase.instance.client;
                await client.from('users').update({
                  'role': selectedRole,
                  'branch_id': selectedBranchId,
                  'client_id': selectedClientId,
                }).eq('id', user['id']);
                Navigator.pop(context, true);
              },
              child: const Text('Guardar'),
            ),
          ],
        ),
      ),
    );

    if (result == true) _loadData();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Gestión de Usuarios')),
      body: _isLoading 
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _users.length,
              itemBuilder: (context, index) {
                final user = _users[index];
                return ListTile(
                  title: Text(user['full_name'] ?? user['email']),
                  subtitle: Text('Rol: ${user['role']}'),
                  trailing: IconButton(
                    icon: const Icon(Icons.edit),
                    onPressed: () => _showEditDialog(user),
                  ),
                );
              },
            ),
    );
  }
}
