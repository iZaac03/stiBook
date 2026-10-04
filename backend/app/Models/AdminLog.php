<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AdminLog extends Model
{
    use HasFactory;
    protected $primaryKey = 'log_id';
    public $timestamps = false; // only has created_at

    protected $fillable = [
        'admin_id',
        'action',
        'target_table',
        'target_id',
        'details',
    ];

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
