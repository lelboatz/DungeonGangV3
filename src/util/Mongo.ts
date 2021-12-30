import { DungeonGang } from "../index";
import { Db, MongoClient, MongoError, ObjectId } from "mongodb";
import { Snowflake } from "discord.js";
import { userSchema } from "./Schema";

export interface MongoUser {
    uuid: string;
    discordId: Snowflake | undefined;
    votedIn: boolean
    votedOut: boolean
    emotes: {
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
        return this.mongo?.collection("newUsers").insertOne(user)
    }

    getUser(uuid: string) {
        return this.mongo?.collection("newUsers").findOne({ uuid })
    }

    updateUser(user: MongoUser) {
        return this.mongo?.collection("newUsers").replaceOne({ uuid: user.uuid }, user)
    }

    getUserByDiscord(id: Snowflake){
        return this.mongo?.collection("newUsers").findOne({ discordId: id })
    }

    getUsersByDiscord(id: Snowflake) {
        return this.mongo?.collection("newUsers").find({ discordId: id }).toArray()
    }

    updateUserByDiscord(user: MongoUser) {
        return this.mongo?.collection("newUsers").replaceOne({ discordId: user.discordId }, user)
    }

    deleteUserByDiscord(id: Snowflake) {
        return this.mongo?.collection("newUsers").deleteOne({ discordId: id })
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
}