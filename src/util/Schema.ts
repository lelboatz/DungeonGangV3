import { Message, Snowflake } from "discord.js";
import { MongoPoll, MongoUser } from "./Mongo";
import { MojangResponse } from "./Functions";

function userSchema(id: Snowflake, uuid: string): MongoUser {
    return {
        _id: id,
        uuid,
        emotes: {
            unlocked: [],
            given: [],
            slots: {
                default: "none"
            }
        }
    }
}

function pollSchema(message: Message, mojang: MojangResponse): MongoPoll {
    let endDate = new Date();
    endDate.setHours(endDate.getHours() + 6);
    return {
        _id: message.id,
        channel: message.channel.id,
        uuid: mojang.id,
        username: mojang.name,
        active: true,
        endDate: endDate.getTime() / 1000,
        votes: {
            positive: [],
            neutral: [],
            negative: []
        },
        stats: {
            cataLevel: 0,
            bloodMobs: 0,
            secrets: 0,
            masterSix: undefined,
            masterSixCompletions: 0,
        }

    }
}

export { userSchema, pollSchema }