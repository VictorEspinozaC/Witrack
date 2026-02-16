import 'package:flutter/material.dart';
import '../db/app_database.dart';
import '../models/models.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class BranchManagementScreen extends StatefulWidget {
  const BranchManagementScreen({super.key});

  @override
  State<BranchManagementScreen> createState() => _BranchManagementScreenState();
}

class _BranchManagementScreenState extends State<BranchManagementScreen> {
  final _db = AppDatabase.instance;
  List<Branch> _branches = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadBranches();
  }

  Future<void> _loadBranches() async {
    setState(() => _isLoading = true);
    final branches = await _db.getAllBranches();
    setState(() {
      _branches = branches;
      _isLoading = false;
    });
  }

  Future<void> _showBranchDialog([Branch? branch]) async {
    final nameController = TextEditingController(text: branch?.name);
    final codeController = TextEditingController(text: branch?.code);
    final isEditing = branch != null;

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isEditing ? 'Editar Sucursal' : 'Nueva Sucursal'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(
                labelText: 'Nombre',
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: codeController,
              decoration: const InputDecoration(
                labelText: 'Código',
                hintText: 'Ej: CENTRAL',
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.characters,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (nameController.text.isEmpty || codeController.text.isEmpty) {
                return;
              }
              
              try {
                if (isEditing) {
                  final updatedBranch = Branch(
                    id: branch.id,
                    name: nameController.text.trim(),
                    code: codeController.text.trim().toUpperCase(),
                  );
                  await _db.updateBranch(updatedBranch);
                } else {
                  final newBranch = Branch(
                    name: nameController.text.trim(),
                    code: codeController.text.trim().toUpperCase(),
                  );
                  await _db.insertBranch(newBranch);
                }
                if (mounted) Navigator.pop(context, true);
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error: ${e.toString()}')),
                  );
                }
              }
            },
            child: Text(isEditing ? 'Guardar' : 'Crear'),
          ),
        ],
      ),
    );

    if (result == true) {
      _loadBranches();
    }
  }

  Future<void> _deleteBranch(Branch branch) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Eliminar Sucursal'),
        content: Text('¿Estás seguro de eliminar ${branch.name}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _db.deleteBranch(branch.id!);
        _loadBranches();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No se pudo eliminar. Puede que tenga datos asociados.')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Usar layout builder o similar para hacer responsive si es necesario
    return Scaffold(
      appBar: AppBar(
        title: const Text('Gestión de Sucursales'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _branches.isEmpty
              ? const Center(
                  child: Text('No hay sucursales registradas'),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _branches.length,
                  itemBuilder: (context, index) {
                    final branch = _branches[index];
                    return Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: Theme.of(context).primaryColor.withOpacity(0.1),
                          child: Text(
                            branch.code.substring(0, 1),
                            style: TextStyle(
                              color: Theme.of(context).primaryColor,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        title: Text(branch.name),
                        subtitle: Text('Código: ${branch.code}'),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.edit, color: Colors.blue),
                              onPressed: () => _showBranchDialog(branch),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete, color: Colors.red),
                              onPressed: () => _deleteBranch(branch),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showBranchDialog(),
        child: const Icon(Icons.add),
      ),
    );
  }
}
