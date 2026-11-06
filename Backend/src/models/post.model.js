const mongoose=require('mongoose');

const postSchema=new mongoose.Schema({
    image: String,
    imageId: String,
    caption: String,
}, { timestamps: true })

const postModel=mongoose.model('post',postSchema);

module.exports=postModel;