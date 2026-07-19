export class ApiResponse {
    success;
    message;
    data;
    meta;
    constructor(success, message, data, meta) {
        this.success = success;
        this.message = message;
        this.data = data;
        this.meta = meta;
    }
}
