#!/bin/sh
# Ubuntu/WSL development helper. All downloaded files remain inside this repository.
set -eu
project=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
directory="$project/.work/redis-portable"
mkdir -p "$directory"
cd "$directory"
if [ ! -x root/usr/bin/redis-server ]; then
  mkdir -p lists/partial cache/archives/partial
  apt-get -o Dir::State::lists="$directory/lists" -o Dir::Cache="$directory/cache" -o Debug::NoLocking=1 update
  apt-get -o Dir::State::lists="$directory/lists" download redis-server redis-tools libatomic1 liblzf1 libjemalloc2
  for package in ./*.deb; do dpkg-deb -x "$package" root; done
fi
export LD_LIBRARY_PATH="$directory/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec root/usr/bin/redis-server --bind 127.0.0.1 --port 16379 --dir "$directory" --appendonly yes --save ''
