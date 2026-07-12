package entities

import "time"

type Shipment struct {
	ID          string       `bson:"_id"         json:"id"`         
	OriginHub   string       `bson:"originHub"   json:"originHub"`   
	DestHub     string       `bson:"destHub"     json:"destHub"`    
	WeightKg    float64      `bson:"weightKg"    json:"weightKg"`   
	SLADeadline time.Time    `bson:"slaDeadline" json:"slaDeadline"`
	Status      string       `bson:"status"      json:"status"`     
	DriverID    string       `bson:"driverId"    json:"driverId"`   
	VehicleID   string       `bson:"vehicleId"   json:"vehicleId"` 
	RouteID     string       `bson:"routeId"     json:"routeId"` 
	Checkpoints []Checkpoint `bson:"checkpoints" json:"checkpoints"` 
	CreatedAt   time.Time    `bson:"createdAt"   json:"createdAt"`
	DeliveredAt *time.Time   `bson:"deliveredAt" json:"deliveredAt"` 
}

type Checkpoint struct {
	HubID      string     `bson:"hubId"      json:"hubId"`
	ArrivedAt  time.Time  `bson:"arrivedAt"  json:"arrivedAt"`
	DepartedAt *time.Time `bson:"departedAt" json:"departedAt"` 
}
