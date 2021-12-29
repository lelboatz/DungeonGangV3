import { DungeonGang } from "../index";
import { Db, MongoClient, MongoError } from "mongodb";
import { Snowflake } from "discord.js";

export interface MongoUser {
    _id: Snowflake;
    uuid: string;
    emotes: {
        unlocked: string[]
        given: string[]
        slots: {
            default: string;
            booster?: string;
            vc500?: string;
            msg100k?: string;
            staff?: string;
        }
    }
}

export interface Poll {
    id: Snowflake;
    channel: Snowflake;
    username: string;
    uuid: string;
    votes: {
        positive: Snowflake[]
        neutral: Snowflake[]
        negative: Snowflake[]
    }
}

export default class MongoUtils {
    client: DungeonGang
    connected: boolean | "errored"
    mongo: Db | null

    constructor(client: DungeonGang) {
        this.client = client;
        this.connected = false;
        this.mongo = null;
    }

    connect() {
        return MongoClient.connect(this.client.config.mongo.uri)
            .then(client => {
                this.mongo = client.db(this.client.config.mongo.db);
                console.log(`Connected to Database ${this.mongo.databaseName}`);
            })
            .catch((error: MongoError) => {
                this.connected = "errored";
                console.error(`Failed to connect to MongoDB: ${error.stack}`);
            })
    }

    addUser(user: MongoUser) {
        // @ts-ignore
        return this.mongo?.collection("users").insertOne(user)
    }

    updateUser(user: MongoUser) {
        // @ts-ignore
        return this.mongo?.collection("users").replaceOne({ _id: user._id }, user)
    }

    getUserByDiscord(id: Snowflake) {
        // @ts-ignore
        return this.mongo?.collection("users").findOne({ _id: id })
    }

    deleteUserByDiscord(id: Snowflake) {
        // @ts-ignore
        return this.mongo?.collection("users").deleteOne({ _id: id })
    }
}