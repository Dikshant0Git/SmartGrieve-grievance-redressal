/**
 * Fake Cloudinary configuration for bypassing image uploads.
 */

const fakeCloudinary = {
    uploader: {
        upload: jest.fn().mockResolvedValue({
            secure_url: 'https://fake.cloudinary.com/image.jpg',
            public_id: 'fake_public_id',
            format: 'jpg',
            width: 800,
            height: 600
        }),
        upload_stream: jest.fn().mockImplementation((options, callback) => {
            const stream = require('stream');
            const pass = new stream.PassThrough();
            pass.on('finish', () => {
                callback(null, {
                    secure_url: 'https://fake.cloudinary.com/image.jpg',
                    public_id: 'fake_public_id',
                    format: 'jpg',
                    width: 800,
                    height: 600
                });
            });
            return pass;
        })
    }
};

module.exports = fakeCloudinary;
