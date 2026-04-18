import { MongoClient } from "mongodb"

// Là on changera pour l'heberger sur un serveur
const client = new MongoClient("mongodb://localhost:27017")

let db
let collection

export async function connectDB() {
  await client.connect()
  db = client.db("transport")
  collection = db.collection("delays")
}

export async function saveDelay(data) {
  if (!collection) throw new Error("DB non initialisée")

  await collection.updateOne(
    {
      routeId: data.routeId,
      terminal: data.terminal
    },
    {
    $set: {
        routeName: data.routeName,
        color: data.color
    },
      $push: {
        delays: {
          date: new Date(),
          delay: data.delay
        }
      }
    },
    { upsert: true }
  )
}