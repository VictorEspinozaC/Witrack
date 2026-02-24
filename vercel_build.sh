#!/bin/bash
set -e

echo "=== Installing Flutter SDK ==="
if [ ! -d "$HOME/flutter" ]; then
  git clone https://github.com/flutter/flutter.git -b stable --depth 1 "$HOME/flutter"
fi
export PATH="$HOME/flutter/bin:$PATH"
flutter --version

echo "=== Creating Supabase config ==="
mkdir -p lib/config
cat > lib/config/supabase_config.dart << 'DART'
class SupabaseConfig {
  static const String url = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: '',
  );
  static const String anonKey = String.fromEnvironment(
    'SUPABASE_KEY',
    defaultValue: '',
  );
}
DART

echo "=== Installing dependencies ==="
flutter pub get

echo "=== Building Flutter web ==="
flutter build web --release \
  --dart-define=SUPABASE_URL="$SUPABASE_URL" \
  --dart-define=SUPABASE_KEY="$SUPABASE_KEY"

echo "=== Build complete ==="
