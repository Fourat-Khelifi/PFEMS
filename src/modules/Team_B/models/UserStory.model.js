import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const UserStorySchema = new Schema({
    title: { type: String, required: true, trim: true },

    description: { type: String, trim: true },

    priority: {
        type: String,
        required: true,
        enum: ['highest', 'high', 'medium', 'low', 'lowest'],
        default: 'medium'
    },



    startDate: { type: Date, required: true },

    endDate: { type: Date, required: true },

    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],

    sprintId: { type: Schema.Types.ObjectId, ref: 'Sprint', required: true },

    deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });


// Index pour améliorer les recherches
UserStorySchema.index(
    { priority: 1, deletedAt: 1 },
    {
        partialFilterExpression: { deletedAt: { $eq: null } },
        background: true
    }
);

// Unicité du nom de la UserStory dans un même sprint
UserStorySchema.index(
    { title: 1, sprintId: 1 },
    { unique: true }
);

const UserStory = model('UserStory', UserStorySchema);

// Sync indexes to clean up old ones (like from storyName)
UserStory.syncIndexes().catch(err => {
    // This might fail if there's existing duplicate data from the old field format
    console.error("Index sync warning (usually ignorable if data is clean):", err.message);
});

export default UserStory;
