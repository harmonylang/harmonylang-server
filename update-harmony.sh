# This script only compiles the latest charm.c executable.

tmp_dir=$(mktemp -d -t harmony-lang-XXXXXXXXXX)
git clone --depth=1 --branch=master https://github.coecis.cornell.edu/rv22/harmony.git "$tmp_dir"

rm -rf harmony-prepare
mkdir harmony-prepare

mv "$tmp_dir/harmony" harmony-prepare
mv "$tmp_dir/modules" harmony-prepare

rm -rf "$tmp_dir"

printf "assert True\n" > harmony-prepare/example.hny
(cd harmony-prepare && ./harmony -t example.hny && mv "$HOME/.charm.c" charm.c)

(cd harmony-prepare && gcc -O3 -std=c99 charm.c -m64 -o charm && rm charm.c)
mv harmony-prepare/charm harmony-master
mv harmony-prepare/harmony harmony-master/harmony.new

rm -rf harmony-prepare
