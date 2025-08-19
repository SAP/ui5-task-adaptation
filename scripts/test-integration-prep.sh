for d in test/fixtures/*/ ; do
    echo "$d"
    npm --prefix $d i
done