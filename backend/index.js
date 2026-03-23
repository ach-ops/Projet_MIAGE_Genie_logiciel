import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import transportRoutes from "./controllers/transport.controllers.js";
import travauxController from "./controllers/travaux.controllers.js"
import { loadGTFS } from "./services/gtfs.service.js";


await loadGTFS();

const app = express();

// Configuration Swagger
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API Transport",
            version: "1.0.0",
            description: "Documentation de l'API pour le projet transport",
        },
    },
    apis: ["./routes/*.js", "./controllers/*.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));


app.use("/api", transportRoutes);
app.use("/api/travaux", travauxController);

app.listen(3000, "0.0.0.0", () => {
    console.log("API STAN Lancé sur le port 3000 (accessible sur le réseau local)");
});