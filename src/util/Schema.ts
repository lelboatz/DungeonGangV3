import { Snowflake } from "discord.js";
import { MongoUser } from "./Mongo";

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

export { userSchema }