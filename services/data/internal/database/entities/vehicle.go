package entities

type Vehicle struct {
	ID             string  `bson:"_id"            json:"id"`
	Type           string  `bson:"type"           json:"type"`
	FuelEfficiency float64 `bson:"fuelEfficiency" json:"fuelEfficiency"`
	EmissionFactor float64 `bson:"emissionFactor" json:"emissionFactor"`
	CapacityKg     float64 `bson:"capacityKg"     json:"capacityKg"`
}
