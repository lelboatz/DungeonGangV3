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

export interface MongoPoll {
    _id: Snowflake;
    channel: Snowflake;
    username: string;
    uuid: string;
    endDate: number;
    active: boolean;
    votes: {
        positive: Snowflake[]
        neutral: Snowflake[]
        negative: Snowflake[]
    }
    stats: PollStats
}

interface PollStats {
    cataLevel: number,
    secrets: number,
    bloodMobs: number,
    masterSix: number | undefined,
    masterSixCompletions: number
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

    getUserByDiscord(id: Snowflake): Promise<any> {
        // @ts-ignore
        return this.mongo?.collection("users").findOne({ _id: id })
    }

    deleteUserByDiscord(id: Snowflake) {
        // @ts-ignore
        return this.mongo?.collection("users").deleteOne({ _id: id })
    }

    addPoll(poll: MongoPoll) {
        // @ts-ignore
        return this.mongo?.collection("polls").insertOne(poll)
    }

    getPoll(id: Snowflake): Promise<any> {
        // @ts-ignore
        return this.mongo?.collection("polls").findOne({ _id: id })
    }

    getPolls(uuid: string) {
        return this.mongo?.collection("polls").find({ uuid: uuid }).toArray()
    }

    getActivePolls(): Promise<MongoPoll[] | undefined> | undefined {
        return this.mongo?.collection("polls").find({ active: true }).toArray() as Promise<MongoPoll[] | undefined> | undefined
    }

    endPoll(id: Snowflake) {
        // @ts-ignore
        return this.mongo?.collection("polls").updateOne({ _id: id }, { $set: { active: false, endDate: (new Date().getTime() / 1000) } })
    }

    updateVotes(id: Snowflake, votes: { positive: Snowflake[], neutral: Snowflake[], negative: Snowflake[] }) {
        // @ts-ignore
        return this.mongo?.collection("polls").updateOne({ _id: id }, { $set: { votes: votes } })
    }

    getUserByUuid(uuid: string): Promise<any> {
        // @ts-ignore
        return this.mongo?.collection("users").findOne({ uuid: uuid })
    }

    deleteUserByUuid(uuid: string) {
        // @ts-ignore
        return this.mongo?.collection("users").deleteOne({ uuid: uuid })
    }
}