import axios from "axios"

export async function listIncidents(req, res) {

    try {

        const response = await axios.get(
            "https://carto.g-ny.org/data/cifs/cifs_waze_v2.json"
        )

        const data = response.data

        res.json(data)

    } catch (error) {

        console.error("Erreur récupération trafic", error)

        res.status(500).json({
            error: "Erreur récupération trafic"
        })

    }
}