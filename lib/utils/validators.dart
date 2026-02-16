String normalizePlate(String raw) {
  return raw
      .toUpperCase()
      .replaceAll(RegExp(r'[^A-Z0-9]'), '');
}

String? extractPlateCandidate(String fullText) {
  final t = normalizePlate(fullText);

  // Formatos típicos Chile: AA0000 o AAAA00
  final matches = RegExp(r'[A-Z]{2}[0-9]{4}|[A-Z]{4}[0-9]{2}')
      .allMatches(t)
      .toList();

  if (matches.isEmpty) return null;
  return matches.first.group(0);
}

bool isValidRut(String rut) {
  final r = rut.toUpperCase().replaceAll(RegExp(r'[^0-9K]'), '');
  if (r.length < 2) return false;

  final body = r.substring(0, r.length - 1);
  final dv = r.substring(r.length - 1);

  int sum = 0;
  int mul = 2;
  for (int i = body.length - 1; i >= 0; i--) {
    sum += int.parse(body[i]) * mul;
    mul = (mul == 7) ? 2 : (mul + 1);
  }

  final mod = 11 - (sum % 11);
  String dvCalc;
  if (mod == 11) dvCalc = '0';
  else if (mod == 10) dvCalc = 'K';
  else dvCalc = mod.toString();

  return dvCalc == dv;
}
