package entities

import "time"

type Weather struct {
	ID           string    `bson:"_id"          json:"id"`
	HubID        string    `bson:"hubId"        json:"hubId"`        
	Timestamp    time.Time `bson:"timestamp"    json:"timestamp"`
	Condition    string    `bson:"condition"    json:"condition"`   
	TemperatureC float64   `bson:"temperatureC" json:"temperatureC"`
	WindKmh      float64   `bson:"windKmh"      json:"windKmh"`
}
