import { runSeed } from '@/scripts/seed'

export { runSeed }

if (require.main === module || process.argv[1]?.endsWith('seed.ts')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}

